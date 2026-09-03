import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchProperties } from '../services/api';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const { data: properties, isLoading } = useQuery({
    queryKey: ['publicProperties'],
    queryFn: fetchProperties,
  });

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] w-full">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full blur-[120px] -z-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-accent/20 rounded-full blur-[120px] -z-10 animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm font-medium text-brand-primary shadow-sm backdrop-blur-sm mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
            </span>
            Premium Home Ownership.
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-100 leading-tight">
            Your Journey to <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent">
              Dream Homeownership
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            Discover flexible pathways to owning your dream home with Cereno Homes. Whether you prefer to Rent-to-Own or Pay-to-Own, we make it simple and secure.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <button
              onClick={() => navigate('/client-login')}
              className="w-full sm:w-auto px-8 py-4 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-2xl font-semibold text-lg transition-all shadow-lg shadow-brand-primary/25 hover:shadow-xl hover:-translate-y-1"
            >
              Get Started Now
            </button>
            <button
              onClick={() => navigate('/client-login')}
              className="w-full sm:w-auto px-8 py-4 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-2xl font-semibold text-lg transition-all backdrop-blur-sm hover:shadow-lg hover:-translate-y-1"
            >
              Login to Portal
            </button>
          </div>
        </div>
      </section>

      {/* Available Properties Section */}
      <section className="bg-brand-surface py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-4">Available Properties</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Find your dream home and apply today.</p>
          </div>

          {isLoading ? (
            <div className="text-slate-400 text-center">Loading available properties...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties?.length === 0 && (
                <div className="text-slate-400 col-span-full text-center">No properties are currently available. Check back later!</div>
              )}
              {properties?.map((property: any) => (
                <div key={property.id} className="glass-panel p-6 rounded-2xl border border-slate-700/50 hover:border-brand-primary/50 transition-all flex flex-col">
                  {property.images && property.images.length > 0 ? (
                    <div className="h-48 bg-slate-800 rounded-xl mb-4 overflow-hidden">
                      <img src={property.images[0]} alt="Property" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-48 bg-slate-800 rounded-xl mb-4 flex items-center justify-center text-slate-500">
                      No Images Available
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs px-2 py-1 rounded border bg-green-500/20 text-green-400 border-green-500/30">
                      AVAILABLE
                    </span>
                    <span className="text-sm font-semibold text-brand-secondary">
                      {property.currency === 'USD' ? '$' : property.currency === 'EUR' ? '€' : 'GHS '}{Number(property.basePrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </span>
                  </div>
                  {property.type && (
                    <div className="text-xs font-medium text-brand-primary mb-1 uppercase tracking-wider">{property.type}</div>
                  )}
                  <h3 className="font-medium text-lg text-slate-100 mb-2">{property.address || 'Address pending'}</h3>
                  <p className="text-slate-400 text-sm mb-4 line-clamp-3 flex-1">{property.description || 'No description available.'}</p>
                  
                  <button 
                    onClick={() => navigate('/dashboard')}
                    className="w-full mt-4 bg-brand-primary hover:bg-brand-primary/90 text-white py-3 rounded-xl transition-colors text-sm font-semibold"
                  >
                    Apply Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-slate-900/50 border-t border-slate-800/50 py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mb-4">Why Choose Cereno Homes?</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">We provide innovative payment solutions designed to help you secure a premium property without the traditional stress.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-700/50 hover:border-brand-primary/50 transition-all duration-300 hover:-translate-y-2 group">
              <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Premium Properties</h3>
              <p className="text-slate-400 leading-relaxed">
                Browse our curated selection of high-quality homes in prime locations, built with exceptional standards.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-700/50 hover:border-brand-accent/50 transition-all duration-300 hover:-translate-y-2 group">
              <div className="w-14 h-14 bg-brand-accent/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Flexible Payments</h3>
              <p className="text-slate-400 leading-relaxed">
                Choose between Pay-to-Own with a small initial deposit, or Rent-to-Own where your rent builds equity over time.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-2 group">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-200 mb-3">Secure & Transparent</h3>
              <p className="text-slate-400 leading-relaxed">
                Track your payments, manage your plans, and stay updated with your homeownership progress in a secure portal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-slate-500 text-sm border-t border-slate-800/50 bg-brand-surface">
        <p>© {new Date().getFullYear()} Cereno Homes. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Landing;
