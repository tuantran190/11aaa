import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="font-serif text-3xl">Yêu cầu đăng nhập</h2>
        <p className="text-stone-400 max-w-xs">Vui lòng đăng nhập để truy cập khu vực này.</p>
        <button 
          onClick={() => window.location.href = '/'} // Simple redirect for demo
          className="bg-black text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest"
        >
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6">
        <h2 className="font-serif text-3xl">Từ chối truy cập</h2>
        <p className="text-stone-400 max-w-xs">Bạn không có quyền xem trang này.</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="bg-black text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest"
        >
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
