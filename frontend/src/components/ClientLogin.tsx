import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  name: z.string().optional(),
  phone: z.string().optional()
});

type AuthForm = z.infer<typeof authSchema>;

const ClientLogin: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthForm>({
    resolver: zodResolver(authSchema)
  });

  const onSubmit = async (data: AuthForm) => {
    setApiError(null);
    try {
      if (isRegister) {
        if (!data.name || !data.phone) {
          setApiError("Name and phone are required for registration");
          return;
        }
        const response = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/client/register`, data);
        localStorage.setItem('clientToken', response.data.token);
      } else {
        const response = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/client/login`, { email: data.email, password: data.password });
        localStorage.setItem('clientToken', response.data.token);
      }
      navigate('/dashboard');
    } catch (error: any) {
      setApiError(error.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="glass-panel max-w-md w-full p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-slate-100">Client <span className="font-semibold text-brand-primary">{isRegister ? 'Registration' : 'Login'}</span></h1>
          <p className="text-slate-400 mt-2 text-sm">{isRegister ? 'Create an account to browse properties' : 'Sign in to your client portal'}</p>
        </div>

        {apiError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {isRegister && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input 
                  {...register('name')}
                  type="text" 
                  className={`w-full bg-slate-900/50 border ${errors.name ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all`}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone Number</label>
                <input 
                  {...register('phone')}
                  type="tel" 
                  className={`w-full bg-slate-900/50 border ${errors.phone ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all`}
                  placeholder="+233..."
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input 
              {...register('email')}
              type="email" 
              className={`w-full bg-slate-900/50 border ${errors.email ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all`}
              placeholder="client@example.com"
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
            {isSubmitting ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)} 
            className="text-sm text-brand-primary hover:text-white transition-colors"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientLogin;
