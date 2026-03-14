import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, Receipt,
  AlertTriangle, Sparkles, Timer
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const CHART_COLORS = ['#D4AF37', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#6366F1', '#14B8A6'];

const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const formatMonth = (str) => {
  if (!str) return '';
  const [y, m] = str.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-primary/30 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-foreground mb-1">{formatMonth(label)}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

const HealthScoreRing = ({ score, rating }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#D4AF37' : score >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#27272A" strokeWidth="10" />
        <circle
          cx="90" cy="90" r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
          style={{ filter: `drop-shadow(0 0 8px ${color}50)`, transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">{rating}</span>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, trend, className = '', delay = 0 }) => (
  <Card className={`border-border/50 hover:border-primary/30 transition-all duration-300 animate-float-up ${className}`}
    style={{ animationDelay: `${delay}s` }}
  >
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-heading font-bold">{value}</p>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-emerald' : 'text-red-500'}`}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="dashboard-loading">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = data && data.transaction_count > 0;
  const analysis = data?.latest_analysis?.data;
  const healthScore = analysis?.financial_summary?.health_score || 0;
  const healthRating = analysis?.financial_summary?.health_rating || 'N/A';

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center" data-testid="dashboard-empty">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="font-heading text-2xl font-bold mb-2">Welcome to Obsidian Vault</h2>
        <p className="text-muted-foreground mb-6 max-w-md">Upload your financial data or load demo transactions to start your AI-powered financial analysis.</p>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/transactions')} data-testid="go-transactions-btn">
            <Receipt className="w-4 h-4 mr-2" />Add Transactions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="dashboard-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Financial Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">{data.transaction_count} transactions analyzed</p>
        </div>
        {!analysis && (
          <Button onClick={() => navigate('/analysis')} data-testid="run-analysis-cta" className="shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            <Sparkles className="w-4 h-4 mr-2" />Run AI Analysis
          </Button>
        )}
      </div>

      {/* Health Score + Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {analysis && (
          <Card className="lg:col-span-4 border-border/50 glow-gold" data-testid="health-score-card">
            <CardContent className="p-6 flex flex-col items-center justify-center">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Financial Health</p>
              <HealthScoreRing score={healthScore} rating={healthRating} />
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {analysis.financial_summary?.key_insights?.slice(0, 2).map((ins, i) => (
                  <Badge key={i} variant="secondary" className="text-xs max-w-[200px] truncate">{ins}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        <div className={`${analysis ? 'lg:col-span-8' : 'lg:col-span-12'} grid grid-cols-2 lg:grid-cols-4 gap-4`}>
          <MetricCard title="Revenue" value={formatCurrency(data.total_income)} icon={DollarSign} delay={0.1} data-testid="metric-revenue" />
          <MetricCard title="Expenses" value={formatCurrency(data.total_expenses)} icon={ArrowUpRight} delay={0.2} data-testid="metric-expenses" />
          <MetricCard title="Net Profit" value={formatCurrency(data.net_profit)} icon={data.net_profit >= 0 ? TrendingUp : TrendingDown} delay={0.3} data-testid="metric-profit" />
          <MetricCard title="Transactions" value={data.transaction_count} icon={Receipt} delay={0.4} data-testid="metric-count" />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 border-border/50" data-testid="cash-flow-chart">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthly_data}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#A1A1AA', fontSize: 12 }} axisLine={{ stroke: '#27272A' }} />
                  <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#A1A1AA', fontSize: 12 }} axisLine={{ stroke: '#27272A' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#10B981" fill="url(#incomeGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="url(#expenseGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-border/50" data-testid="expense-breakdown-chart">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.expense_by_category?.slice(0, 6)}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={75}
                    paddingAngle={3} dataKey="value"
                  >
                    {data.expense_by_category?.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatCurrency(val)} contentStyle={{ background: '#111', border: '1px solid #D4AF3730', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {data.expense_by_category?.slice(0, 5).map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                    <span className="text-muted-foreground truncate max-w-[120px]">{cat.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Alerts + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {analysis?.fraud_detection?.flagged_transactions?.length > 0 && (
          <Card className="lg:col-span-4 border-destructive/30 glow-red" data-testid="risk-alerts-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />Risk Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.fraud_detection.flagged_transactions.slice(0, 4).map((flag, i) => (
                <div key={i} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-red-400">{formatCurrency(flag.amount)}</span>
                    <Badge variant="destructive" className="text-[10px]">Risk {flag.risk_score}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{flag.reason}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className={`${analysis?.fraud_detection?.flagged_transactions?.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} border-border/50`} data-testid="recent-transactions-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} data-testid="view-all-transactions-btn">
              View All <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_transactions?.slice(0, 7).map((txn, i) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-mono text-muted-foreground">{txn.date}</TableCell>
                    <TableCell className="text-sm truncate max-w-[200px]">{txn.description}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{txn.category}</Badge></TableCell>
                    <TableCell className={`text-right text-sm font-medium ${txn.type === 'income' ? 'text-emerald' : 'text-foreground'}`}>
                      {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Audit Score Banner */}
      {analysis?.audit_score && (
        <Card className="border-border/50" data-testid="audit-banner">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                analysis.audit_score.overall_score < 40 ? 'bg-emerald/10 border border-emerald/20' :
                analysis.audit_score.overall_score < 70 ? 'bg-primary/10 border border-primary/20' :
                'bg-destructive/10 border border-destructive/20'
              }`}>
                <Timer className={`w-6 h-6 ${
                  analysis.audit_score.overall_score < 40 ? 'text-emerald' :
                  analysis.audit_score.overall_score < 70 ? 'text-primary' :
                  'text-red-500'
                }`} />
              </div>
              <div>
                <p className="font-heading text-lg font-bold">Audit Risk Score: {analysis.audit_score.overall_score}/100</p>
                <p className="text-sm text-muted-foreground">{analysis.audit_score.rating}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate('/analysis')} data-testid="view-audit-btn">
              View Full Report
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
