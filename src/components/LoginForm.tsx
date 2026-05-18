import React, { useState } from 'react';
import { Ship, Lock, User } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginFormProps {
  onLogin: (role: 'admin' | 'user', email?: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.toLowerCase() === 'admin' && password === 'admin') {
      onLogin('admin', 'admin@example.com');
    } else if (username.toLowerCase() === 'user' && password === 'user') {
      onLogin('user', 'user@example.com');
    } else {
      setError('Invalid credentials. Use admin/admin or user/user.');
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
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-fab-blue hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fab-blue transition-colors"
              >
                Sign in
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500">
                Demo Accounts: <br/><span className="font-mono">admin / admin</span> or <span className="font-mono">user / user</span>
              </p>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
