import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, TrendingUp, Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', company_name: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Please fill in all fields');
    if (isRegister && !form.company_name) return toast.error('Company name is required');
    setLoading(true);
    try {
      if (isRegister) {
        await register(form.email, form.password, form.company_name);
        toast.success('Account created successfully');
      } else {
        await login(form.email, form.password);
        toast.success('Welcome back');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-8 sm:px-12 lg:px-16 bg-background relative">
        <div className="max-w-sm mx-auto w-full">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="font-heading text-xl font-bold tracking-tight">Obsidian Vault</span>
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight mb-2">
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isRegister ? 'Start your AI-powered financial analysis' : 'Sign in to your financial command center'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder="cfo@company.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="h-11 bg-card border-border/50 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="password-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="h-11 bg-card border-border/50 focus:border-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="toggle-password-btn"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="company" className="text-sm font-medium">Company Name</Label>
                <Input
                  id="company"
                  data-testid="company-input"
                  type="text"
                  placeholder="Your Company Inc."
                  value={form.company_name}
                  onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
                  className="h-11 bg-card border-border/50 focus:border-primary"
                />
              </div>
            )}

            <Button
              type="submit"
              data-testid={isRegister ? 'register-submit-btn' : 'login-submit-btn'}
              className="w-full h-11 bg-primary text-primary-foreground font-semibold shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] active:scale-[0.98] transition-all"
              disabled={loading}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                isRegister ? 'Create Account' : 'Sign In'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-primary hover:underline font-medium"
              data-testid="toggle-auth-mode"
            >
              {isRegister ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 50%, #0A0A0A 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url("https://images.unsplash.com/photo-1664854953181-b12e6dda8b7c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGZpbmFuY2lhbCUyMGRhdGElMjBuZXR3b3JrJTIwZGFyayUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzczNTAzODE1fDA&ixlib=rb-4.1.0&q=85")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="relative z-10 text-center max-w-md px-8">
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <TrendingUp className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-heading text-3xl font-bold mb-4">
            AI-Powered<br />Financial Intelligence
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Detect fraud, analyze cash flow, identify profit leaks, and get CFO-level insights powered by advanced AI.
          </p>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald" />
              <span>Fraud Detection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Cash Flow AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Audit Scoring</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
