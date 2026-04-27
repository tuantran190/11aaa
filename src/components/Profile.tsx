import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Loader2, ShieldCheck, Mail, User, Star } from 'lucide-react';
import api from '../lib/api';

export default function Profile() {
  const { user, logout } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Client-side validation: Kiểm tra mật khẩu mới và xác nhận mật khẩu mới phải khớp nhau
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới không trùng khớp');
      return;
    }
    
    // Optional additional validation
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }

    setLoading(true);
    try {
      // Use the newly created API POST /api/users/profile/change-password
      await api.post('/users/profile/change-password', {
        oldPassword,
        newPassword
      });
      
      // Khi gửi API thành công: Hiển thị thông báo bằng Toast
      toast.success('Đổi mật khẩu thành công, vui lòng đăng nhập lại');
      
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Xóa token khỏi localStorage và chuyển hướng về trang /login sau 2 giây
      setTimeout(() => {
        logout(); // Inside logout(), it removes token and sets user to null, returning to Auth screen
      }, 2000);
      
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return 'Quản trị viên';
      case 'staff': return 'Nhân viên';
      case 'shipper': return 'Giao hàng';
      default: return 'Khách hàng';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="font-serif text-3xl mb-2">Trang cá nhân</h2>
        <p className="text-stone-500 text-sm">Quản lý thông tin tài khoản và bảo mật</p>
      </div>

      {/* 2 columns layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Bên trái: Thông tin cá nhân */}
        <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm h-fit space-y-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center text-3xl font-serif text-stone-400">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-serif text-2xl">{user?.name}</h3>
              <p className="text-stone-500 mt-1">{getRoleName(user?.role || 'customer')}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
              <Mail className="text-stone-400" size={20} />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Email</p>
                <p className="font-medium text-stone-800">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
              <ShieldCheck className="text-stone-400" size={20} />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Vai trò (Role)</p>
                <p className="font-medium inline-block bg-black text-white px-3 py-1 rounded-full text-xs mt-1 uppercase tracking-wider">
                  {user?.role}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
              <Star className={user?.isVIP ? "text-yellow-500 fill-yellow-500" : "text-stone-400"} size={20} />
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Hạng khách hàng (Rank)</p>
                <p className={`font-bold mt-1 ${user?.isVIP ? 'text-yellow-600' : 'text-stone-600'}`}>
                  {user?.isVIP ? 'VIP Member' : 'Standard Member'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bên phải: Form Đổi mật khẩu */}
        <div className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm">
          <h3 className="font-serif text-xl mb-6">Đổi mật khẩu</h3>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2 block">Mật khẩu hiện tại</label>
              <input 
                type="password" 
                required
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm transition-all"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            
            <div className="pt-4">
              <label className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2 block">Mật khẩu mới</label>
              <input 
                type="password" 
                required
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm transition-all"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-2 block">Xác nhận mật khẩu mới</label>
              <input 
                type="password" 
                required
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm transition-all"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading || !oldPassword || !newPassword || !confirmPassword}
              className="w-full bg-black text-white py-5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-8"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Lưu mật khẩu mới'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
