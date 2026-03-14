import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Sparkles, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck,
  Building2, Timer, DollarSign, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const severityColor = (s) => {
  switch (s) {
    case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'low': return 'bg-emerald/10 text-emerald border-emerald/20';
    default: return 'bg-muted text-muted-foreground';
  }
};

const riskColor = (score) => {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-emerald';
};

const HealthRing = ({ score, rating }) => {
  const r = 60, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#D4AF37' : score >= 40 ? '#F59E0B' : '#EF4444';
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={r} fill="none" stroke="#27272A" strokeWidth="8" />
        <circle cx="75" cy="75" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 75 75)"
          style={{ filter: `drop-shadow(0 0 6px ${color}50)`, transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{rating}</span>
      </div>
    </div>
  );
};

export const AnalysisPage = () => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();

  const fetchLatest = useCallback(async () => {
    try {
      const res = await api.get('/analysis/latest');
      setAnalysis(res.data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const res = await api.post('/analysis/run');
      setAnalysis(res.data);
      toast.success('AI Analysis complete');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Analysis failed';
      if (msg.includes('No transactions')) {
        toast.error('No transactions found. Add data first.');
        navigate('/transactions');
      } else {
        toast.error(msg);
      }
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="analysis-loading">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const data = analysis?.data;

  return (
    <div className="space-y-6" data-testid="analysis-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">AI Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data ? `Last analyzed: ${new Date(analysis.created_at).toLocaleDateString()}` : 'Run your first AI-powered financial analysis'}
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={running} data-testid="run-analysis-btn"
          className="shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]">
          {running ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing with AI...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />{data ? 'Re-run Analysis' : 'Run AI Analysis'}</>
          )}
        </Button>
      </div>

      {/* Running State */}
      {running && (
        <Card className="border-primary/30 glow-gold" data-testid="analysis-running">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h3 className="font-heading text-xl font-bold mb-2">AI is analyzing your finances...</h3>
            <p className="text-sm text-muted-foreground">GPT-5.2 is reviewing your transactions for fraud, profit leaks, and financial health.</p>
            <p className="text-xs text-muted-foreground mt-2">This may take 15-30 seconds.</p>
          </CardContent>
        </Card>
      )}

      {/* No Analysis State */}
      {!data && !running && (
        <Card className="border-border/50" data-testid="analysis-empty">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-heading text-xl font-bold mb-2">No Analysis Yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">
              Click "Run AI Analysis" to get CFO-level insights, fraud detection, and audit scoring.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && !running && (
        <Tabs defaultValue="summary" className="space-y-6" data-testid="analysis-tabs">
          <TabsList className="bg-card border border-border/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="summary" data-testid="tab-summary" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Financial Summary</TabsTrigger>
            <TabsTrigger value="cashflow" data-testid="tab-cashflow" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Cash Flow</TabsTrigger>
            <TabsTrigger value="leaks" data-testid="tab-leaks" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Profit Leaks</TabsTrigger>
            <TabsTrigger value="fraud" data-testid="tab-fraud" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Fraud Detection</TabsTrigger>
            <TabsTrigger value="vendors" data-testid="tab-vendors" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Vendor Risk</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Audit Score</TabsTrigger>
          </TabsList>

          {/* Financial Summary */}
          <TabsContent value="summary" data-testid="content-summary">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-4 border-border/50 glow-gold">
                <CardContent className="p-6 flex flex-col items-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Health Score</p>
                  <HealthRing score={data.financial_summary?.health_score || 0} rating={data.financial_summary?.health_rating || 'N/A'} />
                </CardContent>
              </Card>
              <div className="lg:col-span-8 grid grid-cols-2 gap-4">
                <Card className="border-border/50"><CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Revenue</p>
                  <p className="font-heading text-2xl font-bold mt-1">{formatCurrency(data.financial_summary?.total_revenue)}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Expenses</p>
                  <p className="font-heading text-2xl font-bold mt-1">{formatCurrency(data.financial_summary?.total_expenses)}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Profit</p>
                  <p className="font-heading text-2xl font-bold mt-1">{formatCurrency(data.financial_summary?.net_profit)}</p>
                </CardContent></Card>
                <Card className="border-border/50"><CardContent className="p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Profit Margin</p>
                  <p className="font-heading text-2xl font-bold mt-1">{data.financial_summary?.profit_margin?.toFixed(1) || 0}%</p>
                </CardContent></Card>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <Card className="border-border/50">
                <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Key Insights</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.financial_summary?.key_insights?.map((ins, i) => (
                    <div key={i} className="flex gap-3 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" /><p className="text-muted-foreground leading-relaxed">{ins}</p></div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald" />Recommendations</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {data.financial_summary?.recommendations?.map((rec, i) => (
                    <div key={i} className="flex gap-3 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-emerald mt-2 shrink-0" /><p className="text-muted-foreground leading-relaxed">{rec}</p></div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Cash Flow */}
          <TabsContent value="cashflow" data-testid="content-cashflow">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border/50"><CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Cash Flow</p>
                <p className="font-heading text-xl font-bold mt-1">{formatCurrency(data.cash_flow?.net_cash_flow)}</p>
              </CardContent></Card>
              <Card className="border-border/50"><CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Monthly Burn Rate</p>
                <p className="font-heading text-xl font-bold mt-1">{formatCurrency(data.cash_flow?.burn_rate)}</p>
              </CardContent></Card>
              <Card className="border-border/50"><CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Cash Runway</p>
                <p className="font-heading text-xl font-bold mt-1">{data.cash_flow?.cash_runway_months || 0} months</p>
              </CardContent></Card>
              <Card className="border-border/50"><CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Trend</p>
                <div className="flex items-center gap-2 mt-1">
                  {data.cash_flow?.trend === 'improving' ? <TrendingUp className="w-5 h-5 text-emerald" /> :
                   data.cash_flow?.trend === 'declining' ? <TrendingDown className="w-5 h-5 text-red-400" /> :
                   <Timer className="w-5 h-5 text-primary" />}
                  <p className="font-heading text-xl font-bold capitalize">{data.cash_flow?.trend || 'N/A'}</p>
                </div>
              </CardContent></Card>
            </div>
            <Card className="border-border/50 mt-6">
              <CardHeader><CardTitle className="font-heading text-base">Cash Flow Insights</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.cash_flow?.insights?.map((ins, i) => (
                  <div key={i} className="flex gap-3 text-sm"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" /><p className="text-muted-foreground leading-relaxed">{ins}</p></div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profit Leaks */}
          <TabsContent value="leaks" data-testid="content-leaks">
            <Card className="border-border/50 mb-6">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Estimated Leaks</p>
                  <p className="font-heading text-2xl font-bold">{formatCurrency(data.profit_leaks?.total_leaks_amount)}</p>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              {data.profit_leaks?.findings?.map((f, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={severityColor(f.severity)}>{f.severity}</Badge>
                          <span className="text-sm font-medium">{f.category}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{f.description}</p>
                        <p className="text-xs text-primary">{f.recommendation}</p>
                      </div>
                      <p className="font-heading text-lg font-bold text-yellow-400 whitespace-nowrap">{formatCurrency(f.amount)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Fraud Detection */}
          <TabsContent value="fraud" data-testid="content-fraud">
            <Card className="border-border/50 mb-6">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  data.fraud_detection?.risk_level === 'high' ? 'bg-red-500/10 border border-red-500/20' :
                  data.fraud_detection?.risk_level === 'medium' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                  'bg-emerald/10 border border-emerald/20'
                }`}>
                  <AlertTriangle className={`w-6 h-6 ${
                    data.fraud_detection?.risk_level === 'high' ? 'text-red-400' :
                    data.fraud_detection?.risk_level === 'medium' ? 'text-yellow-400' : 'text-emerald'
                  }`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Overall Fraud Risk Level</p>
                  <p className="font-heading text-2xl font-bold capitalize">{data.fraud_detection?.risk_level || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader><CardTitle className="font-heading text-base">Flagged Transactions</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs text-right">Risk Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.fraud_detection?.flagged_transactions?.map((f, i) => (
                      <TableRow key={i} className="hover:bg-muted/30">
                        <TableCell className="text-sm max-w-[200px] truncate">{f.description}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(f.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px]">{f.reason}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-bold ${riskColor(f.risk_score)}`}>{f.risk_score}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendor Risk */}
          <TabsContent value="vendors" data-testid="content-vendors">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="font-heading text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />Vendor Risk Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Vendor</TableHead>
                      <TableHead className="text-xs">Total Payments</TableHead>
                      <TableHead className="text-xs">Transactions</TableHead>
                      <TableHead className="text-xs">Risk Factors</TableHead>
                      <TableHead className="text-xs text-right">Risk Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.vendor_risk?.vendors?.map((v, i) => (
                      <TableRow key={i} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium">{v.name}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(v.total_payments)}</TableCell>
                        <TableCell className="text-sm">{v.transaction_count}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {v.risk_factors?.slice(0, 2).map((f, j) => (
                              <Badge key={j} variant="secondary" className="text-[10px]">{f}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={v.risk_score} className="w-16 h-1.5" />
                            <span className={`font-mono text-sm font-bold ${riskColor(v.risk_score)}`}>{v.risk_score}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Score */}
          <TabsContent value="audit" data-testid="content-audit">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className={`lg:col-span-4 border-border/50 ${
                data.audit_score?.overall_score >= 70 ? 'glow-red' :
                data.audit_score?.overall_score >= 40 ? 'glow-gold' : 'glow-emerald'
              }`}>
                <CardContent className="p-6 flex flex-col items-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Audit Risk Score</p>
                  <HealthRing score={data.audit_score?.overall_score || 0} rating={data.audit_score?.rating || 'N/A'} />
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    {data.audit_score?.overall_score < 40 ? 'Low risk - financial controls are strong' :
                     data.audit_score?.overall_score < 70 ? 'Moderate risk - some areas need attention' :
                     'High risk - immediate attention required'}
                  </p>
                </CardContent>
              </Card>
              <Card className="lg:col-span-8 border-border/50">
                <CardHeader>
                  <CardTitle className="font-heading text-base">Contributing Factors</CardTitle>
                  <CardDescription>Factors affecting your audit risk score</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.audit_score?.factors?.map((f, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        f.impact === 'positive' ? 'bg-emerald/10' : 'bg-red-500/10'
                      }`}>
                        {f.impact === 'positive' ?
                          <ShieldCheck className="w-4 h-4 text-emerald" /> :
                          <AlertTriangle className="w-4 h-4 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{f.name}</span>
                          <span className={`text-xs font-mono font-bold ${f.impact === 'positive' ? 'text-emerald' : 'text-red-400'}`}>{f.score}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{f.description}</p>
                        <Progress value={f.score} className="mt-1.5 h-1" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
