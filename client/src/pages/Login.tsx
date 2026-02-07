import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  
  const sendMagicLink = trpc.customAuth.sendMagicLink.useMutation();
  
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await sendMagicLink.mutateAsync({ email });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    }
  };
  
  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#1a2332] rounded-2xl p-8 shadow-2xl border border-slate-700">
          <h1 className="text-2xl font-bold text-white text-center mb-8">
            Welcome to Predictive Apex
          </h1>
          
          {!sent ? (
            <>
              {/* Google OAuth Button */}
              <button
                onClick={handleGoogleLogin}
                className="w-full bg-[#4285f4] hover:bg-[#357ae8] text-white py-3.5 px-4 rounded-lg mb-6 flex items-center justify-center gap-3 font-medium transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
              
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#1a2332] text-slate-400">OR</span>
                </div>
              </div>
              
              {/* Email Magic Link Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0f1419] text-white px-4 py-3.5 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    required
                    disabled={sendMagicLink.isPending}
                  />
                </div>
                
                {error && (
                  <div className="text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={sendMagicLink.isPending}
                  className="w-full bg-[#2d3748] hover:bg-[#3d4758] text-white py-3.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sendMagicLink.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
              </form>
              
              {/* Info text about bot dashboard */}
              <div className="mt-6 pt-6 border-t border-slate-700">
                <p className="text-xs text-slate-400 text-center">
                  Sign in to manage your Polymarket trading bots
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
              <p className="text-slate-400 mb-6">
                We've sent a magic link to <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-sm text-slate-500">
                Click the link in the email to sign in. The link will expire in 15 minutes.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-6 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                Use a different email
              </button>
            </div>
          )}
          
          <div className="mt-6 text-center text-xs text-slate-500">
            <a href="#" className="hover:text-slate-400">Terms</a>
            {' • '}
            <a href="#" className="hover:text-slate-400">Privacy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
