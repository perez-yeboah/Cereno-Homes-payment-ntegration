import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginForm = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginForm) => {
    setApiError(null);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/auth/login`, data);
      localStorage.setItem('adminToken', response.data.token);
      navigate('/admin');
    } catch (error: any) {
      setApiError(error.response?.data?.error || 'Failed to login');
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-slate-100">Admin <span className="font-semibold text-brand-primary">Login</span></h1>
          <p className="text-slate-400 mt-2 text-sm">Sign in to manage Cereno Homes platform</p>
        </div>

        {apiError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input 
              {...register('email')}
              type="email" 
              className={`w-full bg-slate-900/50 border ${errors.email ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all`}
              placeholder="admin@cerenohomes.com"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <input 
                {...register('password')}
                type={showPassword ? "text" : "password"}
                className={`w-full bg-slate-900/50 border ${errors.password ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 pr-12 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all`}
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-medium rounded-xl px-4 py-3.5 mt-4 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center"
          >
            {isSubmitting ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
