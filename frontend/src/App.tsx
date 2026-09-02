import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClientLogin from './components/ClientLogin';
import ClientDashboard from './components/ClientDashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Landing from './components/Landing';
import PaymentVerify from './components/PaymentVerify';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Re-render on route change
  
  const isAdmin = !!localStorage.getItem('adminToken');
  const isClient = !!localStorage.getItem('clientToken');
  const isLoggedIn = isAdmin || isClient;

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('clientToken');
    navigate('/client-login');
  };

  return (
    <nav className="glass-panel sticky top-0 z-50 flex justify-between items-center px-8 py-4">
      <Link to="/" className="font-semibold text-xl tracking-wide hover:opacity-80 transition-opacity">
        Cereno<span className="text-brand-primary">Homes</span>
      </Link>
      <div className="flex gap-6 text-sm font-medium items-center">
        {isLoggedIn && <Link to="/dashboard" className="text-slate-300 hover:text-white transition-colors">Client Portal</Link>}
        {isAdmin && <Link to="/admin" className="text-slate-300 hover:text-white transition-colors">Admin Dashboard</Link>}
        {isLoggedIn && (
          <button 
            onClick={handleLogout} 
            className="text-red-400 hover:text-red-300 transition-colors ml-4 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/10"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="font-sans antialiased bg-brand-surface text-slate-100 min-h-screen flex flex-col">
          <Navigation />
          
          <main className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/client-login" element={<ClientLogin />} />
              <Route path="/dashboard" element={<ClientDashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/payment/verify" element={<PaymentVerify />} />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
