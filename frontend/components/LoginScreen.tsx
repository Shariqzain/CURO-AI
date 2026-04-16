'use client';

import { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Stethoscope, RefreshCw } from 'lucide-react';

export default function LoginScreen({ onLogin }: { onLogin?: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin?.();
    } catch (err: any) {
      setError(err.message.replace('Firebase:', '').trim());
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onLogin?.();
    } catch (err: any) {
      setError(err.message.replace('Firebase:', '').trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#05070a]">
      {/* Background Orbs for Depth */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-curo-accent/10 rounded-full blur-[160px] animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-curo-purple/10 rounded-full blur-[160px] animate-pulse" />
      
      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-curo-accent to-curo-purple p-[1px] mb-6 shadow-2xl">
            <div className="w-full h-full bg-[#0a0f1a] rounded-2xl flex items-center justify-center">
              <Stethoscope size={40} className="text-curo-accent" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
            CURO <span className="text-transparent bg-clip-text bg-gradient-to-r from-curo-accent to-curo-purple">AI</span>
          </h1>
          <p className="text-curo-text-dim text-sm font-light">Clinical Diagnostic Intelligence Panel</p>
        </div>

        <div className="glass-card-strong p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
          
          <form onSubmit={handleEmailAuth} className="space-y-6 relative">
            <div className="flex gap-4 p-1 bg-white/[0.03] rounded-xl border border-white/5 mb-6">
              <button 
                type="button"
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${!isSignUp ? 'bg-white/10 text-white shadow-lg' : 'text-curo-text-dim hover:text-white'}`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${isSignUp ? 'bg-white/10 text-white shadow-lg' : 'text-curo-text-dim hover:text-white'}`}
              >
                Join Curo
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-curo-text-muted uppercase tracking-widest mb-2 ml-1">Work Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full curo-input h-12 px-4 text-sm"
                  placeholder="doctor@hospital.org"
                  required
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-curo-text-muted uppercase tracking-widest mb-2 ml-1">Security Key</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full curo-input h-12 px-4 text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-curo-rose/10 border border-curo-rose/20 text-curo-rose text-xs text-center animate-shake">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-curo-accent to-curo-purple text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-curo-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : (isSignUp ? 'Initialize Account' : 'Access Dashboard')}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="px-3 bg-transparent text-curo-text-dim">Network Access</span></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full h-12 bg-white/[0.03] border border-white/10 text-white rounded-xl font-medium text-sm hover:bg-white/[0.07] transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Institutional Google
          </button>
        </div>

        <p className="text-center mt-8 text-curo-text-dim text-[10px] uppercase tracking-[0.2em] leading-relaxed">
          HIPAA Compliant • Clinical Grade Architecture
        </p>
      </div>
    </div>
  );
}