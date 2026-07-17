import React, { useState } from 'react';
import { Ship, Lock, User } from 'lucide-react';
import { motion } from 'motion/react';
import { signInWithGoogle } from '../services/firebaseService';

interface LoginFormProps {
  onLogin: (role: 'admin' | 'user' | 'checker' | 'approver', email?: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.toLowerCase();
    if (u === 'admin' && password === 'admin') {
      try {
        setIsSigningInWithGoogle(true);
        setError('');
        const { googleSignIn } = await import('../services/googleSheetsService');
        // Automatically request Google Sheets linking for the admin during their login step
        const googleRes = await googleSignIn();
        if (googleRes) {
          onLogin('admin', googleRes.user.email || 'admin@example.com');
        } else {
          onLogin('admin', 'admin@example.com');
        }
      } catch (err: any) {
        if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user') || err?.code === 'auth/cancelled-popup-request') {
          // If popup is closed/cancelled, still log them in so they can access the station
          onLogin('admin', 'admin@example.com');
        } else {
          console.error('Admin automatic Google Sheets link failed:', err);
          onLogin('admin', 'admin@example.com');
        }
      } finally {
        setIsSigningInWithGoogle(false);
      }
    } else if (u === 'user' && password === 'user') {
      onLogin('user', 'user@example.com');
    } else if (u === 'checker' && password === 'checker') {
      onLogin('checker', 'checker@example.com');
    } else if (u === 'approver' && password === 'approver') {
      onLogin('approver', 'approver@example.com');
    } else {
      setError('Invalid credentials. Use admin/admin, user/user, checker/checker, or approver/approver.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsSigningInWithGoogle(true);
      setError('');
      const googleUser = await signInWithGoogle();
      if (googleUser && googleUser.email) {
        const emailLower = googleUser.email.toLowerCase();
        // Automatically assign admin role if logged in with workspace owner email
        const isAdminEmail = emailLower === 'raphael.monta.gomez@gmail.com' || emailLower.startsWith('admin');
        const role = isAdminEmail ? 'admin' : 'user';
        onLogin(role, googleUser.email);
      } else {
        setError('Google sign-in completed but email was not found.');
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        console.log('User closed Google sign-in window.');
      } else {
        console.error('Google Sign-In Error:', err);
        setError(err.message || 'Failed to authenticate with Google. Please try again.');
      }
    } finally {
      setIsSigningInWithGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-fab-blue p-3 rounded-xl shadow-lg">
            <Ship className="w-12 h-12 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Port Services Division
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in to access your dashboard
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                Username
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="focus:ring-fab-blue focus:border-fab-blue block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
                  placeholder="admin or user"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-fab-blue focus:border-fab-blue block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
                  placeholder="Password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-fab-blue hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fab-blue transition-colors cursor-pointer"
              >
                Sign in
              </button>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500 font-bold tracking-wider">Or Applicants login</span>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSigningInWithGoogle}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-md shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fab-blue transition-all cursor-pointer hover:border-slate-300 disabled:opacity-50"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                {isSigningInWithGoogle ? 'Connecting...' : 'Sign in with Gmail (Google)'}
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500">
                Demo Roles: <br/>
                <span className="font-mono font-bold">user</span> (Applicant) | <span className="font-mono font-bold">checker</span> (Checker)<br/>
                <span className="font-mono font-bold">approver</span> (Approver) | <span className="font-mono font-bold">admin</span> (All Access)<br/>
                <span className="text-[10px] text-slate-400 mt-1 block">Credentials: Username and password are identical (e.g. checker/checker).</span>
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
