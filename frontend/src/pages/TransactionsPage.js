import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Upload, Plus, Trash2, Database, FileSpreadsheet, MoreHorizontal, Filter
} from 'lucide-react';
import { toast } from 'sonner';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '', amount: '', type: 'expense',
    category: '', vendor: '', payment_method: '', notes: ''
  });
  const fileRef = useRef(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = {};
      if (filterType !== 'all') params.type = filterType;
      const res = await api.get('/transactions', { params });
      setTransactions(res.data);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/transactions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message);
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount || !form.category) {
      return toast.error('Please fill required fields');
    }
    try {
      await api.post('/transactions', {
        ...form,
        amount: parseFloat(form.amount)
      });
      toast.success('Transaction added');
      setDialogOpen(false);
      setForm({
        date: new Date().toISOString().split('T')[0],
        description: '', amount: '', type: 'expense',
        category: '', vendor: '', payment_method: '', notes: ''
      });
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Transaction deleted');
      fetchTransactions();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const loadDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await api.post('/transactions/demo');
      toast.success(res.data.message);
      fetchTransactions();
    } catch {
      toast.error('Failed to load demo data');
    } finally {
      setDemoLoading(false);
    }
  };

  const formatCurrency = (num) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(num);

  return (
    <div className="space-y-6" data-testid="transactions-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">{transactions.length} records</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadDemo} disabled={demoLoading} data-testid="load-demo-btn">
            <Database className="w-4 h-4 mr-2" />
            {demoLoading ? 'Loading...' : 'Load Demo Data'}
          </Button>
          <label htmlFor="file-upload">
            <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="upload-btn">
              <Upload className="w-4 h-4 mr-2" />{uploading ? 'Uploading...' : 'Upload CSV/Excel'}
            </Button>
          </label>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} data-testid="file-input" />

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-transaction-btn" className="shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                <Plus className="w-4 h-4 mr-2" />Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-heading">Add Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={form.date} data-testid="txn-date-input"
                      onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      className="bg-background border-border/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Type</Label>
                    <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="bg-background border-border/50" data-testid="txn-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Description *</Label>
                  <Input value={form.description} data-testid="txn-description-input"
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Payment description" className="bg-background border-border/50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Amount *</Label>
                    <Input type="number" step="0.01" value={form.amount} data-testid="txn-amount-input"
                      onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00" className="bg-background border-border/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Category *</Label>
                    <Input value={form.category} data-testid="txn-category-input"
                      onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                      placeholder="e.g. Marketing" className="bg-background border-border/50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Vendor</Label>
                    <Input value={form.vendor} data-testid="txn-vendor-input"
                      onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))}
                      placeholder="Vendor name" className="bg-background border-border/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Payment Method</Label>
                    <Input value={form.payment_method} data-testid="txn-payment-input"
                      onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                      placeholder="Credit Card" className="bg-background border-border/50" />
                  </div>
                </div>
                <Button type="submit" className="w-full" data-testid="txn-submit-btn">Add Transaction</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Upload Area (when empty) */}
      {transactions.length === 0 && !loading && (
        <Card className="border-dashed border-2 border-border hover:border-primary/30 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()} data-testid="upload-area"
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-2">Upload Financial Data</h3>
            <p className="text-sm text-muted-foreground mb-4">Drag & drop your CSV or Excel file, or click to browse</p>
            <p className="text-xs text-muted-foreground">Supported: .csv, .xlsx, .xls</p>
          </CardContent>
        </Card>
      )}

      {/* Filter + Table */}
      {(transactions.length > 0 || loading) && (
        <Card className="border-border/50" data-testid="transactions-table-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Transaction Records</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-background" data-testid="filter-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs">Vendor</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 50).map((txn) => (
                      <TableRow key={txn.id} className="hover:bg-muted/30" data-testid={`txn-row-${txn.id}`}>
                        <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{txn.date}</TableCell>
                        <TableCell className="text-sm max-w-[250px] truncate">{txn.description}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{txn.category}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{txn.vendor || '-'}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${txn.type === 'income' ? 'bg-emerald/10 text-emerald border-emerald/20' : 'bg-muted text-muted-foreground'}`}>
                            {txn.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right text-sm font-medium whitespace-nowrap ${txn.type === 'income' ? 'text-emerald' : ''}`}>
                          {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`txn-actions-${txn.id}`}>
                                <MoreHorizontal className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleDelete(txn.id)} className="text-red-500 focus:text-red-500">
                                <Trash2 className="w-3 h-3 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {transactions.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Showing 50 of {transactions.length} transactions</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
