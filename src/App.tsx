import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { 
  ShoppingBag, 
  Truck, 
  BarChart3, 
  Package, 
  ChevronRight,
  Heart,
  LogOut,
  User as UserIcon,
  Search,
  X,
  Trash2,
  Plus,
  Flower,
  Phone,
  Facebook,
  Instagram
} from 'lucide-react';
import ProductCard from './components/ProductCard';
import ProductSkeleton from './components/ProductSkeleton';
import ShipperDashboard from './components/ShipperDashboard';
import CheckoutModal from './components/CheckoutModal';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProductManager from './components/AdminProductManager';
import ReviewModal from './components/ReviewModal';
import ChangePasswordForm from './components/ChangePasswordForm';
import Profile from './components/Profile';
import OrderSuccess from './components/OrderSuccess';
import ProductDetailModal from './components/ProductDetailModal';
import OrderStepper from './components/OrderStepper';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import api from './lib/api';
import { Role, Product, Order } from './types';
import Fuse from 'fuse.js';

function AppContent() {
  const { user, login, logout } = useAuth();
  const { cart, addToCart } = useCart();
  const [view, setView] = useState<'home' | 'shop' | 'dashboard' | 'order-success' | 'profile'>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priceFilter, setPriceFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [occasionFilter, setOccasionFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const [isSaleOnly, setIsSaleOnly] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const uniqueTags = Array.from(new Set(products.map(p => p.category)));

  // Perform search and filter
  let displayedProducts = [...products];
  let searchResultsInfo: { item: Product; matches?: readonly any[] }[] = [];

  if (debouncedSearch.trim()) {
    const fuse = new Fuse(displayedProducts, {
      keys: ['name', 'category'],
      threshold: 0.4,
      includeMatches: true,
      ignoreLocation: true,
    });
    searchResultsInfo = fuse.search(debouncedSearch);
    displayedProducts = searchResultsInfo.map(res => res.item);
  } else {
    searchResultsInfo = displayedProducts.map(p => ({ item: p }));
  }

  if (priceFilter !== 'all') {
    displayedProducts = displayedProducts.filter(p => {
      const finalPrice = p.price * (1 - (p.discount || 0) / 100);
      if (priceFilter === 'under500') return finalPrice < 500000;
      if (priceFilter === '500to1500') return finalPrice >= 500000 && finalPrice <= 1500000;
      if (priceFilter === 'over1500') return finalPrice > 1500000;
      return true;
    });
    searchResultsInfo = searchResultsInfo.filter(res => displayedProducts.some(dp => dp.id === res.item.id));
  }

  if (isSaleOnly) {
    displayedProducts = displayedProducts.filter(p => (p.discount || 0) > 0);
    searchResultsInfo = searchResultsInfo.filter(res => displayedProducts.some(dp => dp.id === res.item.id));
  }

  if (tagFilter !== 'all') {
    displayedProducts = displayedProducts.filter(p => p.category === tagFilter);
    searchResultsInfo = searchResultsInfo.filter(res => displayedProducts.some(dp => dp.id === res.item.id));
  }

  if (occasionFilter !== 'all') {
    displayedProducts = displayedProducts.filter(p => p.occasions && p.occasions.includes(occasionFilter));
    searchResultsInfo = searchResultsInfo.filter(res => displayedProducts.some(dp => dp.id === res.item.id));
  }

  if (colorFilter !== 'all') {
    displayedProducts = displayedProducts.filter(p => p.color === colorFilter);
    searchResultsInfo = searchResultsInfo.filter(res => displayedProducts.some(dp => dp.id === res.item.id));
  }


  const [orders, setOrders] = useState<Order[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', confirmPassword: '', name: '', role: 'customer', phone: '', oldPassword: '' });
  
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({
    reason: 'Hoa héo',
    images: [] as string[]
  });
  const [settings, setSettings] = useState({
    heroImage: 'https://picsum.photos/seed/flower-hero/800/1000',
    heroTitle: 'Nghệ thuật trong từng Đóa hoa.',
    heroSubtitle: 'Kiến tạo những tác phẩm hoa độc bản cho những tâm hồn tinh tế tại Hải Phòng.',
    hotline: '0123 456 789',
    address: '18 Đà Nẵng, Hải Phòng',
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    zalo: '0123456789'
  });

  const fetchSettings = React.useCallback(async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to fetch settings');
    }
  }, []);

  useEffect(() => {
    if (user?.requirePasswordChange && view !== 'force-password-change') {
      setView('force-password-change');
      toast.error('Bảo mật: Yêu cầu cập nhật mật khẩu lần đầu.');
    } else if (user && !user.requirePasswordChange && view === 'force-password-change') {
      if (user.role === 'customer') {
        setView('home');
      } else {
        setView('dashboard');
      }
    } else if (view === 'dashboard' && !user) {
      const storedRole = localStorage.getItem('role');
      if (!storedRole) {
        setView('home');
        setIsAuthModalOpen(true);
        toast.error('Vui lòng đăng nhập để tiếp tục');
      }
    }
  }, [view, user]);

  const fetchProducts = React.useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const res = await api.get('/products?page=1&limit=100');
      setProducts(res.data.items ? res.data.items : res.data);
    } catch (err) {
      console.error('Failed to fetch products');
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const fetchOrders = React.useCallback(async () => {
    try {
      const res = await api.get('/orders/mine');
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, [fetchProducts, fetchSettings]);

  useEffect(() => {
    if (user && (user.role === 'customer' || user.role === 'admin' || user.role === 'staff')) {
      fetchOrders();
      // Polling for real-time updates every 15 seconds
      const interval = setInterval(fetchOrders, 15000);
      return () => clearInterval(interval);
    }
  }, [user, view, fetchOrders]);

  const openReview = async (orderId: string, productId: string) => {
    // Refresh orders to get latest status
    await fetchOrders();
    const order = orders.find(o => o.id === orderId);
    if (order && (order.status === 'delivered' || order.status === 'completed')) {
      setSelectedOrderId(orderId);
      setSelectedProductId(productId);
      setIsReviewOpen(true);
    } else {
      toast.error('Đơn hàng chưa ở trạng thái sẵn sàng để đánh giá. Vui lòng tải lại trang.');
    }
  };

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!validateEmail(authForm.email)) {
      toast.error('Vui lòng nhập email đúng định dạng');
      return;
    }

    if (authMode === 'forgot') {
      if (!authForm.oldPassword) {
        toast.error('Vui lòng nhập mật khẩu cũ');
        return;
      }
      if (!authForm.password || authForm.password.length < 6) {
        toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
        return;
      }
      if (authForm.password !== authForm.confirmPassword) {
        toast.error('Mật khẩu xác nhận không khớp');
        return;
      }

      setIsAuthLoading(true);
      try {
        const res = await api.post('/auth/forgot-password', { 
          email: authForm.email,
          oldPassword: authForm.oldPassword,
          newPassword: authForm.password
        });
        toast.success(res.data.message);
        setAuthMode('login');
        setAuthForm({ ...authForm, oldPassword: '', password: '', confirmPassword: '' });
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Không thể đổi mật khẩu');
      } finally {
        setIsAuthLoading(false);
      }
      return;
    }

    if (!authForm.password || authForm.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (authMode === 'register') {
      if (!authForm.name) {
        toast.error('Vui lòng nhập họ tên');
        return;
      }
      if (!authForm.phone) {
        toast.error('Vui lòng nhập số điện thoại');
        return;
      }
      if (authForm.password !== authForm.confirmPassword) {
        toast.error('Mật khẩu nhập lại không khớp');
        return;
      }
    }

    setIsAuthLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const res = await api.post(endpoint, authForm);
      const userObj = { ...res.data.user, requirePasswordChange: res.data.requirePasswordChange };
      login(res.data.token, userObj);
      setIsAuthModalOpen(false);
      toast.success(authMode === 'login' ? 'Đăng nhập thành công' : 'Đăng ký thành công');
      
      // Role-based navigation
      if (res.data.requirePasswordChange) {
        setView('force-password-change');
      } else {
        const role = res.data.user.role;
        if (role === 'admin') setView('dashboard');
        else if (role === 'shipper') setView('dashboard');
        else if (role === 'staff') setView('dashboard');
        else setView('home');
      }

    } catch (err: any) {
      const message = err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại';
      toast.error(message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const renderNav = () => (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-100 px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className="font-serif text-2xl tracking-tight font-bold cursor-pointer" onClick={() => setView('home')}>L'Artiste Fleur</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mt-1 ml-2">{settings.address}</span>
      </div>
      
      <div className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest font-medium text-stone-600">
        <button onClick={() => setView('home')} className={`hover:text-black transition-colors ${view === 'home' ? 'text-black' : ''}`}>Trang chủ</button>
        <button onClick={() => setView('shop')} className={`hover:text-black transition-colors ${view === 'shop' ? 'text-black' : ''}`}>Mẫu hoa</button>
        {user && user.role === 'customer' && (
          <button onClick={() => setView('dashboard')} className={`hover:text-black transition-colors ${view === 'dashboard' ? 'text-black' : ''}`}>Đơn hàng</button>
        )}
        {user && ['admin', 'staff', 'shipper'].includes(user.role) && (
          <button onClick={() => setView('dashboard')} className={`hover:text-black transition-colors ${view === 'dashboard' ? 'text-black' : ''}`}>Quản trị</button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-2 border-l border-stone-200 pl-4 ml-4">
            <button 
              onClick={() => setView('profile')}
              className={`flex items-center gap-3 p-2 rounded-2xl transition-all ${view === 'profile' ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
            >
              <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center font-serif text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-widest">{user.name}</p>
                <p className="text-[8px] text-stone-400 uppercase tracking-tighter">
                  {user.role === 'admin' ? 'Quản trị viên' : user.role === 'shipper' ? 'Giao hàng' : user.role === 'staff' ? 'Nhân viên' : 'Khách hàng'}
                </p>
              </div>
            </button>
            <button onClick={logout} className="p-2 hover:bg-stone-50 rounded-full transition-colors text-stone-400 hover:text-red-500" title="Đăng xuất">
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="p-2 hover:bg-stone-50 rounded-full transition-colors text-stone-600"
          >
            <UserIcon size={20} strokeWidth={1.5} />
          </button>
        )}
        
        <button 
          onClick={() => cart.length > 0 && setIsCheckoutOpen(true)}
          className="relative p-2 hover:bg-stone-50 rounded-full transition-colors"
        >
          <ShoppingBag size={20} strokeWidth={1.5} />
          {cart.length > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-black text-white text-[10px] flex items-center justify-center rounded-full">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          )}
        </button>
      </div>
    </nav>
  );

  const renderHero = () => (
    <motion.section 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-32 pb-20 px-6 max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center"
    >
      <div className="space-y-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="font-serif text-6xl md:text-8xl leading-[0.9] tracking-tighter">
            {settings.heroTitle}
          </h1>
        </motion.div>
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-stone-500 max-w-md leading-relaxed"
        >
          {settings.heroSubtitle}
        </motion.p>
        <div className="flex gap-4">
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={() => setView('shop')}
            className="bg-black text-white px-8 py-4 rounded-full text-sm uppercase tracking-widest hover:bg-stone-800 transition-all flex items-center gap-2 group"
          >
            Khám phá ngay
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </div>
      </div>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
        className="relative aspect-[4/5] rounded-[40px] overflow-hidden shadow-2xl"
      >
        <img 
          src={settings.heroImage} 
          alt="Hero Flower" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/10" />
      </motion.div>

      {/* Trust Section */}
      <div className="md:col-span-2 mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-stone-100 pt-16">
        <div className="flex flex-col items-center text-center p-8 bg-stone-50 rounded-[40px] transition-all hover:bg-stone-100">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm text-stone-800">
            <Truck size={32} strokeWidth={1} />
          </div>
          <h4 className="font-serif text-xl mb-2">Giao hoa hỏa tốc 2h</h4>
          <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Nội thành Hải Phòng</p>
        </div>
        
        <div className="flex flex-col items-center text-center p-8 bg-stone-50 rounded-[40px] transition-all hover:bg-stone-100">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm text-stone-800">
            <Flower size={32} strokeWidth={1} />
          </div>
          <h4 className="font-serif text-xl mb-2">Hoa tươi nhập mỗi ngày</h4>
          <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Chất lượng tuyển chọn</p>
        </div>

        <div className="flex flex-col items-center text-center p-8 bg-stone-50 rounded-[40px] transition-all hover:bg-stone-100">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm text-stone-800">
            <Phone size={32} strokeWidth={1} />
          </div>
          <h4 className="font-serif text-xl mb-2">Hỗ trợ tận tâm</h4>
          <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">{settings.hotline}</p>
        </div>
      </div>

      {/* Featured Products Selection */}
      <div className="md:col-span-2 mt-32">
        <div className="flex flex-col items-center text-center mb-16">
          <p className="text-[10px] uppercase tracking-[0.4em] text-stone-400 font-bold mb-4">Discovery</p>
          <h2 className="font-serif text-5xl md:text-6xl text-black">MẪU HOA MỚI NHẤT</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.slice(0, 4).map((product) => (
            <div key={product.id} onClick={() => setSelectedProduct(product)} className="cursor-pointer">
              <ProductCard product={product} onAddToCart={addToCart} />
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-16">
          <button 
            onClick={() => setView('shop')}
            className="group flex flex-col items-center gap-4"
          >
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-stone-400 group-hover:text-black transition-colors">Xem tất cả bộ sưu tập</span>
            <div className="w-12 h-12 rounded-full border border-stone-200 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
              <ChevronRight size={20} />
            </div>
          </button>
        </div>
      </div>
    </motion.section>
  );

  const renderShop = () => (
    <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
        <div>
          <h2 className="font-serif text-4xl mb-2">Bộ sưu tập</h2>
          <p className="text-stone-400 text-sm uppercase tracking-widest">Được tuyển chọn dành riêng cho bạn</p>
        </div>
        
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-64 z-50">
              <input
                type="text"
                placeholder="Tìm kiếm hoa..."
                className="w-full pl-10 pr-10 py-3 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              />
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-black">
                  <X size={16} />
                </button>
              )}
              {isSearchFocused && searchTerm.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden max-h-80 overflow-y-auto">
                  {(() => {
                    const instantFuse = new Fuse(products, {
                      keys: ['name', 'category'],
                      threshold: 0.4,
                    });
                    const suggestions = instantFuse.search(searchTerm).slice(0, 5).map(r => r.item as Product);
                    if (suggestions.length === 0) return <p className="p-4 text-xs text-stone-400">Không có gợi ý</p>;
                    return suggestions.map((product: Product) => (
                      <div 
                        key={product.id} 
                        className="flex items-center gap-3 p-3 hover:bg-stone-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSearchTerm(product.name);
                          setIsSearchFocused(false);
                        }}
                      >
                        <img src={product.image} className="w-10 h-10 object-cover rounded-xl" />
                        <div>
                          <p className="text-sm font-bold truncate max-w-[150px]">{product.name}</p>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{product.price.toLocaleString('vi-VN')}đ</p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Filter Options */}
      <div className="space-y-4 mb-8 pb-4 border-b border-stone-100">
        
        {/* Row 1: Price */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-widest font-bold text-stone-400 w-20">Giá:</span>
          <button 
            onClick={() => setPriceFilter('all')}
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${priceFilter === 'all' ? 'bg-black text-white shadow-md' : 'bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-800'}`}
          >
            Tất cả
          </button>
          <button 
            onClick={() => setPriceFilter('under500')}
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${priceFilter === 'under500' ? 'bg-black text-white shadow-md' : 'bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-800'}`}
          >
            Dưới 500k
          </button>
          <button 
            onClick={() => setPriceFilter('500to1500')}
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${priceFilter === '500to1500' ? 'bg-black text-white shadow-md' : 'bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-800'}`}
          >
            500k - 1.5 triệu
          </button>
          <button 
            onClick={() => setPriceFilter('over1500')}
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${priceFilter === 'over1500' ? 'bg-black text-white shadow-md' : 'bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-800'}`}
          >
            Trên 1.5 triệu
          </button>
          <label className="flex items-center gap-3 ml-4 cursor-pointer group">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={isSaleOnly}
                onChange={(e) => setIsSaleOnly(e.target.checked)}
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${isSaleOnly ? 'bg-red-500' : 'bg-stone-200'}`} />
              <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isSaleOnly ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${isSaleOnly ? 'text-red-500' : 'text-stone-400 group-hover:text-stone-600'}`}>
              Săn Sale
            </span>
          </label>
        </div>

        {/* Row 2: Occasions */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-widest font-bold text-stone-400 w-20">Dịp lễ:</span>
          <button 
            onClick={() => setOccasionFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${occasionFilter === 'all' ? 'bg-black text-white shadow-md' : 'bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
          >
            Tất cả
          </button>
          {['Sinh nhật', 'Khai trương', 'Tình yêu', 'Xin lỗi'].map(occ => (
            <button 
              key={occ}
              onClick={() => setOccasionFilter(occ)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${occasionFilter === occ ? 'bg-black text-white shadow-md' : 'bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
            >
              {occ}
            </button>
          ))}
        </div>

        {/* Row 3: Colors */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-widest font-bold text-stone-400 w-20">Màu sắc:</span>
          <button 
            onClick={() => setColorFilter('all')}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${colorFilter === 'all' ? 'border-black bg-stone-100' : 'border-transparent bg-stone-50 hover:bg-stone-200'}`}
          >
            <span className="text-[10px] font-bold">ALL</span>
          </button>
          {[
            { id: 'Đỏ', hex: 'bg-red-500' }, 
            { id: 'Trắng', hex: 'bg-stone-100' }, 
            { id: 'Hồng', hex: 'bg-pink-400' }, 
            { id: 'Vàng', hex: 'bg-yellow-400' }
          ].map(color => (
            <button 
              key={color.id}
              onClick={() => setColorFilter(color.id)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${color.hex} ${colorFilter === color.id ? 'border-black scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-110'}`}
              title={color.id}
            />
          ))}
        </div>
      </div>

      {/* Result Count */}
      <div className="mb-6">
        <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">
          {isLoadingProducts ? 'Đang tải...' : `Tìm thấy ${searchResultsInfo.length} sản phẩm ${debouncedSearch ? `cho "${debouncedSearch}"` : ''}`}
        </p>
      </div>
      
      {/* Products Grid */}
      {isLoadingProducts ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
          {[1, 2, 3, 4, 5, 6].map(i => <ProductSkeleton key={i} />)}
        </div>
      ) : searchResultsInfo.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
          {searchResultsInfo.map(({ item: product, matches }) => {
            const nameMatch = matches?.find((m: any) => m.key === 'name');
            return (
              <div key={product.id} onClick={() => setSelectedProduct(product)}>
                <ProductCard 
                  product={product} 
                  onAddToCart={addToCart} 
                  highlightIndices={nameMatch?.indices} 
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-24 px-6 bg-stone-50 rounded-[40px] border border-stone-100">
          <div className="w-32 h-32 mx-auto mb-6 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Search size={48} className="text-stone-300" />
          </div>
          <h3 className="font-serif text-3xl mb-3 text-stone-800">Không tìm thấy mẫu hoa nào</h3>
          <p className="text-stone-500 mb-8 max-w-md mx-auto">
            Rất tiếc, chúng tôi không phân phối mẫu hoa phù hợp với tìm kiếm của bạn. Hãy thử đổi từ khóa hoặc điều kiện lọc nhé.
          </p>
          <button 
            onClick={() => {
              setSearchTerm('');
              setPriceFilter('all');
              setTagFilter('all');
              setIsSaleOnly(false);
            }}
            className="bg-black text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-md"
          >
            Xem tất cả hoa
          </button>
        </div>
      )}
    </section>
  );

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await api.post(`/orders/${selectedOrder.id}/return`, returnForm);
      toast.success('Gửi yêu cầu trả hàng thành công. Chúng tôi sẽ phản hồi sớm nhất.');
      setIsReturnModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể gửi yêu cầu trả hàng');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
    try {
      await api.post(`/orders/${orderId}/cancel`);
      toast.success('Đã hủy đơn hàng');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng');
    }
  };

  const renderDashboard = () => {
    if (!user) return <ProtectedRoute children={null} />;

    if (user.role === 'shipper') {
      return (
        <ProtectedRoute allowedRoles={['shipper', 'admin']}>
          <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
            <ShipperDashboard />
          </section>
        </ProtectedRoute>
      );
    }

    const dashboards = {
      customer: (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm">
            <h3 className="font-serif text-2xl mb-6">Lịch sử đơn hàng</h3>
            <div className="space-y-6">
              {Array.isArray(orders) && orders.map((order) => (
                <div key={order.id} className="flex flex-col md:flex-row md:items-center gap-6 pb-6 border-b border-stone-50 last:border-0">
                  <div className="w-20 h-20 rounded-2xl bg-stone-100 overflow-hidden flex-shrink-0">
                    <img src={order.items[0]?.image || "https://picsum.photos/seed/rose/200/200"} alt="Order" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{order.items[0]?.name} {order.items.length > 1 && `và ${order.items.length - 1} sản phẩm khác`}</p>
                    <p className="text-xs text-stone-400 uppercase tracking-widest">Mã đơn #{order.id}</p>
                    <p className="text-[10px] text-stone-400 mt-1 mb-4">Ngày đặt: {new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
                    <OrderStepper 
                      status={order.status} 
                      role="customer" 
                      statusHistory={order.statusHistory} 
                      reason={order.status === 'cancelled' || order.status === 'failed' ? order.failedReason : (order.status === 'returned' || order.status === 'refunded') ? order.returnReason : undefined}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    {(order.status === 'delivered' || order.status === 'completed') && !order.reviewed && order.returnStatus === 'None' && (
                      <button 
                        onClick={() => openReview(order.id, order.items[0]?.product || '')}
                        className="bg-black text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all"
                      >
                        Đánh giá
                      </button>
                    )}
                    {(order.status === 'delivered' || order.status === 'completed') && order.returnStatus === 'None' && (
                      <button 
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsReturnModalOpen(true);
                        }}
                        className="border border-stone-200 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-stone-50 transition-all text-stone-600"
                      >
                        Trả hàng/Khiếu nại
                      </button>
                    )}
                    {order.returnStatus !== 'None' && order.returnStatus !== 'Completed' && (
                      <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] rounded-full font-bold uppercase tracking-widest border border-amber-100">
                        {order.returnStatus === 'Requested' ? 'Đã yêu cầu Trả hàng' : 
                         order.returnStatus === 'Approved' ? 'Chấp nhận hoàn tiền' : 'Từ chối trả hàng'}
                      </span>
                    )}
                    {order.reviewed && (
                      <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest italic">Đã đánh giá</span>
                    )}
                    {order.status === 'pending' && (
                      <button 
                        onClick={() => {
                          if (!order.isPaid && order.paymentMethod !== 'COD') {
                            toast.error('Đơn hàng đang chờ thanh toán qua Cổng. Vui lòng nhắn tin cho Admin để hủy.');
                            return;
                          }
                          handleCancelOrder(order.id);
                        }}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                          !order.isPaid && order.paymentMethod !== 'COD' 
                            ? 'bg-stone-100 text-stone-400 cursor-not-allowed opacity-50' 
                            : 'border border-red-200 text-red-600 hover:bg-red-50'
                        }`}
                        title={(!order.isPaid && order.paymentMethod !== 'COD') ? 'Chờ thanh toán Gateway. Không thể tự hủy.' : ''}
                      >
                        Hủy đơn
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <p className="text-center py-10 text-stone-400 text-sm">Bạn chưa có đơn hàng nào.</p>
              )}
            </div>
          </div>
        </div>
      ),
      staff: (
        <ProtectedRoute allowedRoles={['staff', 'admin']}>
          <AdminProductManager onProductChange={() => { fetchProducts(); fetchSettings(); }} />
        </ProtectedRoute>
      ),
      admin: (
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminProductManager onProductChange={() => { fetchProducts(); fetchSettings(); }} />
        </ProtectedRoute>
      ),
      shipper: (
        <ProtectedRoute allowedRoles={['shipper', 'admin']}>
          <ShipperDashboard />
        </ProtectedRoute>
      )
    };

    return (
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center">
            {user.role === 'customer' && <Heart size={24} strokeWidth={1.5} />}
            {user.role === 'staff' && <Package size={24} strokeWidth={1.5} />}
            {user.role === 'shipper' && <Truck size={24} strokeWidth={1.5} />}
            {user.role === 'admin' && <BarChart3 size={24} strokeWidth={1.5} />}
          </div>
          <div>
            <h2 className="font-serif text-4xl capitalize">Trang {user.role === 'admin' ? 'Quản trị' : user.role === 'shipper' ? 'Giao hàng' : user.role === 'staff' ? 'Nhân viên' : 'Khách hàng'}</h2>
            <p className="text-stone-400 text-sm uppercase tracking-widest">Chào mừng trở lại, {user.name}</p>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={user.role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {dashboards[user.role]}
          </motion.div>
        </AnimatePresence>
      </section>
    );
  };

  return (
    <div className="min-h-screen">
      <Toaster position="bottom-right" />
      
      {renderNav()}
      
      <main>
        {view === 'home' && renderHero()}
        {view === 'shop' && renderShop()}
        {view === 'profile' && (
          <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
            <Profile />
          </section>
        )}
        {view === 'force-password-change' && (
          <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">
             <div className="mb-6 text-center max-w-md">
               <h2 className="text-2xl font-serif text-red-600 mb-2">Yêu cầu bảo mật</h2>
               <p className="text-stone-600 text-sm">Tài khoản của bạn cần thay đổi mật khẩu mặc định trước khi có thể tiếp tục sử dụng hệ thống.</p>
             </div>
             <ChangePasswordForm 
               isForceChange={true} 
               onSuccess={() => {
                 if (user?.role === 'customer') {
                   setView('home');
                 } else {
                   setView('dashboard');
                 }
               }} 
             />
          </section>
        )}
        {view === 'dashboard' && renderDashboard()}
        {view === 'order-success' && lastOrder && (
          <OrderSuccess 
            order={lastOrder} 
            onContinue={() => {
              setView('dashboard');
              fetchOrders();
            }} 
          />
        )}
      </main>

      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        onSuccess={(order) => {
          setLastOrder(order);
          setView('order-success');
          toast.success('Đặt hàng thành công!');
        }}
      />

      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        orderId={selectedOrderId}
        productId={selectedProductId}
        onSuccess={fetchOrders}
      />

      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
      />

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAuthModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[40px] p-10 shadow-2xl">
              <h3 className="font-serif text-3xl mb-6">
                {authMode === 'login' ? 'Chào mừng trở lại' : authMode === 'register' ? 'Tạo tài khoản mới' : 'Đổi mật khẩu'}
              </h3>
              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && (
                  <input type="text" placeholder="Họ và tên" required className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} />
                )}
                <input type="email" placeholder="Địa chỉ Email" required className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
                
                {authMode === 'register' && (
                  <input type="tel" placeholder="Số điện thoại" required className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} />
                )}

                {authMode === 'forgot' && (
                  <input type="password" placeholder="Mật khẩu cũ" required className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black" value={authForm.oldPassword} onChange={e => setAuthForm({...authForm, oldPassword: e.target.value})} />
                )}

                <input type="password" placeholder={authMode === 'forgot' ? 'Mật khẩu mới' : 'Mật khẩu'} required className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
                
                {(authMode === 'register' || authMode === 'forgot') && (
                  <input type="password" placeholder="Nhập lại mật khẩu mới" required className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black" value={authForm.confirmPassword} onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})} />
                )}
                
                {authMode === 'login' && (
                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setAuthMode('forgot')}
                      className="text-[10px] uppercase tracking-widest font-bold text-stone-400 hover:text-black"
                    >
                      Đổi mật khẩu?
                    </button>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={isAuthLoading}
                  className="w-full bg-black text-white py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAuthLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {authMode === 'login' ? 'Đăng nhập' : authMode === 'register' ? 'Đăng ký' : 'Gửi yêu cầu'}
                </button>
              </form>
              <p className="mt-6 text-center text-xs text-stone-400">
                {authMode === 'login' ? "Chưa có tài khoản? " : "Quay lại "}
                <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-black font-bold hover:underline">
                  {authMode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập ngay'}
                </button>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Modal (Customer) */}
      <AnimatePresence>
        {isReturnModalOpen && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsReturnModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[40px] p-10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="font-serif text-3xl">Trả hàng/Hoàn tiền</h3>
                  <p className="text-stone-400 text-[10px] uppercase tracking-widest mt-1">Đơn hàng #{selectedOrder.id.slice(-6).toUpperCase()}</p>
                </div>
                <button onClick={() => setIsReturnModalOpen(false)} className="text-stone-400 hover:text-black">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleReturnSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">Lý do trả hàng</label>
                  <select 
                    value={returnForm.reason}
                    onChange={(e) => setReturnForm({...returnForm, reason: e.target.value})}
                    className="w-full bg-stone-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                    required
                  >
                    <option value="Hoa héo">Hoa héo / Không tươi</option>
                    <option value="Sai mẫu">Sai mẫu mã / Màu sắc</option>
                    <option value="Giao trễ">Giao trễ so với yêu cầu</option>
                    <option value="Hư hỏng">Hoa bị dập nát / Hư hỏng khi vận chuyển</option>
                    <option value="Khác">Lý do khác</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">Ghi chú thêm</label>
                  <textarea 
                    placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
                    className="w-full bg-stone-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase font-bold text-stone-400">Hình ảnh minh chứng</label>
                  <div className="grid grid-cols-3 gap-4">
                    {returnForm.images.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-stone-100">
                        <img src={img} alt="Proof" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setReturnForm({ ...returnForm, images: returnForm.images.filter((_, i) => i !== idx) })}
                          className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <label
                      className="aspect-square rounded-xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center gap-2 text-stone-400 hover:text-black hover:border-black transition-all cursor-pointer"
                    >
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          if (file.size > 10 * 1024 * 1024) {
                            toast.custom((t) => (
                              <div className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl shadow-lg">
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                <span className="text-xs font-medium">File quá lớn, hệ thống đang tự động nén ảnh cho bạn...</span>
                              </div>
                            ), { duration: 3000 });
                          }

                          try {
                            const options = {
                              maxSizeMB: 1,
                              maxWidthOrHeight: 1200,
                              useWebWorker: true,
                              initialQuality: 0.8
                            };
                            
                            const compressedFile = await imageCompression(file, options);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setReturnForm({ ...returnForm, images: [...returnForm.images, reader.result as string] });
                              toast.success('Đã tải lên ảnh minh chứng');
                            };
                            reader.onerror = () => {
                              toast.error('Lỗi khi đọc file ảnh');
                            };
                            reader.readAsDataURL(compressedFile);
                          } catch (err) {
                            toast.error('Lỗi khi nén ảnh');
                          }
                        }}
                      />
                      <Plus size={20} />
                      <span className="text-[10px] uppercase font-bold">Thêm ảnh</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsReturnModalOpen(false)}
                    className="flex-1 py-4 border border-stone-200 rounded-full text-xs font-bold uppercase tracking-widest"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-black text-white rounded-full font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                  >
                    Gửi yêu cầu
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-24 px-6 border-t border-stone-100 bg-[#FBFBF9]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 text-stone-500 text-sm">
          <div className="md:col-span-2">
            <h3 className="font-serif text-4xl mb-8 text-black">L'Artiste Fleur</h3>
            <p className="max-w-sm leading-relaxed mb-10 text-stone-600">
              Nơi kết tinh nghệ thuật từ những đóa hoa tươi thắm nhất, mang đến niềm cảm hứng bất tận cho không gian sống của bạn tại Hải Phòng.
            </p>
            <div className="flex gap-4">
              {settings.facebook && (
                <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full border border-stone-200 flex items-center justify-center hover:bg-black hover:text-white transition-all group shadow-sm">
                  <Facebook size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
                </a>
              )}
              {settings.instagram && (
                <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full border border-stone-200 flex items-center justify-center hover:bg-black hover:text-white transition-all group shadow-sm">
                  <Instagram size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
                </a>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-black font-bold uppercase tracking-[0.2em] text-[10px] mb-8">Contact Information</h4>
            <ul className="space-y-6">
              {settings.hotline && (
                <li>
                  <p className="text-[10px] uppercase font-bold text-stone-400 mb-1">Hotline</p>
                  <a href={`tel:${settings.hotline}`} className="text-black font-medium hover:underline">{settings.hotline}</a>
                </li>
              )}
              {settings.zalo && (
                <li>
                  <p className="text-[10px] uppercase font-bold text-stone-400 mb-1">Zalo Support</p>
                  <p className="text-black font-medium">{settings.zalo}</p>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-black font-bold uppercase tracking-[0.2em] text-[10px] mb-8">Studio Address</h4>
            <div className="space-y-2">
              <p className="text-black leading-relaxed font-medium">{settings.address}</p>
              <p className="text-xs text-stone-400">Hải Phòng, Việt Nam</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-24 pt-10 border-t border-stone-200 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400">
          <p>© 2024 L'Artiste Fleur. Crafted with passion.</p>
          <div className="flex gap-10">
            <button className="hover:text-black transition-colors">Privacy Policy</button>
            <button className="hover:text-black transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}
