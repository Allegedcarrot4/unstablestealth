import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertTriangle, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const SAVED_PASSWORD_KEY = 'saved_password';

export const Login = () => {
  const [password, setPassword] = useState('');
  const [username, setUsernameInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const { login, setUsername, isBanned, needsUsername } = useAuth();
  const navigate = useNavigate();

  // Load saved password on mount
  useEffect(() => {
    const savedPassword = localStorage.getItem(SAVED_PASSWORD_KEY);
    if (savedPassword) {
      setPassword(savedPassword);
      setRememberPassword(true);
    }
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(password);
    
    if (result.success) {
      // Save or remove password based on checkbox
      if (rememberPassword) {
        localStorage.setItem(SAVED_PASSWORD_KEY, password);
      } else {
        localStorage.removeItem(SAVED_PASSWORD_KEY);
      }
      
      if (!result.needsUsername) {
        navigate('/');
      }
    } else {
      setError(result.error || 'Login failed');
    }
    
    setIsLoading(false);
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await setUsername(username);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Failed to set username');
    }
    
    setIsLoading(false);
  };

  if (isBanned) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="flex justify-center">
            <div className="p-6 rounded-full bg-destructive/20 border border-destructive/50">
              <AlertTriangle className="h-16 w-16 text-destructive" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold font-mono text-destructive">ACCESS DENIED</h1>
            <p className="mt-4 text-muted-foreground">
              Your device has been banned from accessing this application.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Username step
  if (needsUsername) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-primary/10 neon-glow border border-primary/30">
                <User className="h-12 w-12 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold font-mono text-primary text-glow">
                CHOOSE USERNAME
              </h1>
              <p className="mt-2 text-muted-foreground">Pick a display name for the chat</p>
            </div>
          </div>

          <form onSubmit={handleUsernameSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Username (2-20 characters)"
                  value={username}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className={cn(
                    "pl-10 font-mono h-12 text-lg",
                    error && "border-destructive"
                  )}
                  autoFocus
                  maxLength={20}
                  minLength={2}
                />
              </div>
              {error && (
                <p className="text-destructive text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-mono"
              disabled={isLoading || username.trim().length < 2}
            >
              {isLoading ? 'SAVING...' : 'CONTINUE'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-primary/10 neon-glow border border-primary/30">
              <Shield className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold font-mono text-primary text-glow">
              UNSTABLE STEALTH
            </h1>
            <p className="mt-2 text-muted-foreground">Enter password to continue</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "pl-10 font-mono h-12 text-lg",
                  error && "border-destructive"
                )}
                autoFocus
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberPassword}
                onCheckedChange={(checked) => setRememberPassword(checked as boolean)}
              />
              <label
                htmlFor="remember"
                className="text-sm text-muted-foreground cursor-pointer select-none"
              >
                Remember password
              </label>
            </div>
            
            {error && (
              <p className="text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-lg font-mono"
            disabled={isLoading || !password}
          >
            {isLoading ? 'AUTHENTICATING...' : 'ACCESS'}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground font-mono">
          Unauthorized access is prohibited
        </p>
      </div>
    </div>
  );
};
