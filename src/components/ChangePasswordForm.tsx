import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import api from '../lib/api';

export default function ChangePasswordForm({ isForceChange, onSuccess }: { isForceChange?: boolean, onSuccess?: () => void }) {
  const { logout, login } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const hasLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);

  const isPasswordValid = hasLength && hasLetter && hasNumber;
  
  let strengthScore = 0;
  if (hasLength) strengthScore++;
  if (hasLetter && hasNumber) strengthScore++;
  if (hasUpper) strengthScore++;
  if (newPassword.length >= 12) strengthScore++;

  const getStrengthColor = () => {
    if (strengthScore <= 1) return 'bg-red-500';
    if (strengthScore === 2) return 'bg-amber-400';
    if (strengthScore >= 3) return 'bg-green-500';
    return 'bg-stone-200';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới không trùng khớp');
      return;
    }
    if (!isPasswordValid) {
      toast.error('Mật khẩu mới chưa đủ mạnh');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        oldPassword,
        newPassword
      });
      toast.success(res.data.message || 'Đổi mật khẩu thành công.');
      // Only do auto login update if it returns a user and we are forcing change
      if (res.data.user && isForceChange) {
        login(localStorage.getItem('token') || '', res.data.user);
      } else if (!isForceChange) {
        // If not forced (meaning done normally from profile), just logout or update token
        if (res.data.user) {
          login(localStorage.getItem('token') || '', res.data.user);
        } else {
          logout();
        }
      } else {
         logout();
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 max-w-md w-full">
      <h3 className="text-xl font-serif mb-6">Đổi mật khẩu</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2 block">Mật khẩu hiện tại</label>
          <input 
            type="password" 
            required
            className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2 block">Mật khẩu mới</label>
          <input 
            type="password" 
            required
            className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {newPassword && (
            <div className="mt-4 p-4 rounded-xl bg-stone-50 space-y-3">
              <div className="flex gap-1 h-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <div 
                    key={level} 
                    className={`flex-1 rounded-full ${level <= strengthScore ? getStrengthColor() : 'bg-stone-200'}`}
                  />
                ))}
              </div>
              <ul className="text-xs text-stone-500 space-y-1">
                <li className={`flex items-center gap-2 ${hasLength ? 'text-green-600' : ''}`}>
                  <span className={hasLength ? 'opacity-100' : 'opacity-50'}>•</span> Ít nhất 8 ký tự
                </li>
                <li className={`flex items-center gap-2 ${(hasLetter && hasNumber) ? 'text-green-600' : ''}`}>
                  <span className={(hasLetter && hasNumber) ? 'opacity-100' : 'opacity-50'}>•</span> Có ít nhất 1 chữ và 1 số
                </li>
              </ul>
            </div>
          )}
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2 block">Xác nhận mật khẩu mới</label>
          <input 
            type="password" 
            required
            className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !oldPassword || !newPassword || !confirmPassword || !isPasswordValid}
          className="w-full bg-black text-white py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Lưu mật khẩu mới'}
        </button>
      </form>
    </div>
  );
}
