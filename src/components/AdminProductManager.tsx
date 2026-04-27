import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import imageCompression from 'browser-image-compression';
import * as XLSX from 'xlsx';
import { 
  Upload, Plus, Package, Image as ImageIcon, Trash2, Clock, 
  ListChecks, CheckCircle, Truck, MessageSquare, Star, Users, 
  BarChart3, DollarSign, ShoppingBag, AlertCircle, ChevronRight,
  Search, Filter, Edit3, X, ExternalLink, UserPlus, Settings as SettingsIcon,
  Database, ClipboardList, Warehouse, Factory, ArrowDownCircle, ArrowUpCircle,
  Key, History, RotateCcw, User as UserIcon, PackageCheck, Pencil, ChevronDown, FileDown
} from 'lucide-react';
import { Order, Review, Product, User } from '../types';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ConfirmModal';
import OrderStepper from './OrderStepper';
import { 
   BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  revenueChart: { name: string; revenue: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  worstProducts: { name: string; quantity: number; revenue: number }[];
}

interface AdminProductManagerProps {
  onProductChange?: () => void;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'manage_inventory', name: 'Quản lý kho & Giá' },
  { id: 'approve_orders', name: 'Duyệt đơn hàng' },
  { id: 'manage_returns', name: 'Trả hàng/Hoàn tiền' },
  { id: 'manage_hr', name: 'Quản lý nhân sự' },
  { id: 'view_revenue', name: 'Xem doanh thu' },
  { id: 'delete_data', name: 'Xóa dữ liệu' }
];

export default function AdminProductManager({ onProductChange }: AdminProductManagerProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'stats' | 'products' | 'orders' | 'customers' | 'staff' | 'settings' | 'inventory' | 'suppliers' | 'shifts'>(() => {
    if (isAdmin) return 'stats';
    if (user?.role === 'shipper') return 'shifts';
    const permissions = user?.permissions || [];
    if (permissions.includes('view_revenue')) return 'stats';
    if (permissions.includes('manage_inventory')) return 'products';
    if (permissions.includes('approve_orders')) return 'orders';
    if (permissions.includes('manage_hr')) return 'staff';
    return 'orders';
  });
  useEffect(() => {
    // Determine the available tabs based on permissions
    const permittedTabs = [
      { id: 'stats', permission: 'view_revenue' },
      { id: 'products', permission: 'manage_inventory' },
      { id: 'inventory', permission: 'manage_inventory' },
      { id: 'suppliers', permission: 'manage_inventory' },
      { id: 'shifts', permission: null },
      { id: 'orders', permission: 'approve_orders' },
      { id: 'customers', permission: 'manage_hr' },
      { id: 'staff', permission: 'manage_hr' },
      { id: 'settings', adminOnly: true },
      { id: 'profile', permission: null },
    ].filter(tab => {
      if (isAdmin) return true;
      if (tab.adminOnly) return false;
      if (tab.permission) {
        return user?.permissions?.includes(tab.permission);
      }
      return true;
    }).map(t => t.id);

    if (!permittedTabs.includes(activeTab)) {
      setActiveTab(permittedTabs[0] as any);
    }
  }, [user, isAdmin]);

  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [products, setProducts] = useState<Product[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shiftModal, setShiftModal] = useState<{ isOpen: boolean; type: 'start' | 'end' }>({ isOpen: false, type: 'start' });
  const [shiftActionForm, setShiftActionForm] = useState({ startCash: '', actualCashReceived: '', notes: '' });
  const [stats, setStats] = useState<Stats | null>(null);
  const [siteSettings, setSiteSettings] = useState({
    heroImage: '',
    heroTitle: '',
    heroSubtitle: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    momoPhone: '',
    hotline: '',
    address: '',
    facebook: '',
    instagram: '',
    zalo: ''
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
  const [isReturnHandleOpen, setIsReturnHandleOpen] = useState(false);
  const [selectedProductHistory, setSelectedProductHistory] = useState<Product | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);

  // Generic Confirm Modal State
  const [globalConfirm, setGlobalConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'warning' | 'danger' | 'info'
  });
  
  const [editForm, setEditForm] = useState({
    street: '',
    ward: '',
    district: '',
    cardMessage: ''
  });

  const [returnHandleForm, setReturnHandleForm] = useState({
    status: 'Approved' as 'Approved' | 'Rejected',
    refundAmount: 0,
    restock: true
  });
  
  const [form, setForm] = useState({
    name: '',
    originalPrice: '',
    discount: '0',
    isStackable: false,
    price: '',
    costPrice: '',
    category: 'Roses',
    occasions: [] as string[],
    color: '',
    stock: '',
    image: '',
    minStock: '5',
    unit: 'bó',
    isHidden: false
  });

  const [importForm, setImportForm] = useState({
    productId: '',
    quantity: '',
    price: '',
    supplierId: '',
    reason: 'Nhập hàng mới'
  });

  const [wasteForm, setWasteForm] = useState({
    productId: '',
    quantity: '',
    reason: 'Hoa héo/dập'
  });

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    mainCategory: '',
    productIds: [] as string[]
  });

  const [ticketForm, setTicketForm] = useState({
    type: 'import' as 'import' | 'export' | 'waste',
    supplierId: '',
    items: [{ productId: '', quantity: '', importPrice: '' }],
    notes: ''
  });

  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as 'staff' | 'shipper' | 'admin',
    permissions: [] as string[]
  });

  const [userSearch, setUserSearch] = useState('');
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userFormErrors, setUserFormErrors] = useState<{ email?: string; password?: string }>({});
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<User | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    isVIP: false
  });

  const validateUserForm = () => {
    const errors: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(staffForm.email)) {
      errors.email = 'Email không đúng định dạng';
    }
    
    if (staffForm.password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    
    setUserFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    fetchData();
    api.get('/shifts/current').then(res => setActiveShift(res.data)).catch(() => {});
  }, [activeTab, timeframe, productPage, orderPage]);

  const handleEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await api.patch(`/orders/${selectedOrder.id}/edit`, {
        address: {
          street: editForm.street,
          ward: editForm.ward,
          district: editForm.district
        },
        cardMessage: editForm.cardMessage
      });
      toast.success('Cập nhật thông tin đơn hàng thành công');
      setIsEditOrderOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Không thể cập nhật thông tin đơn hàng');
    }
  };

  const handleReturnAction = async () => {
    if (!selectedOrder) return;
    try {
      await api.patch(`/orders/${selectedOrder.id}/return-handle`, returnHandleForm);
      toast.success('Xử lý yêu cầu trả hàng thành công');
      setIsReturnHandleOpen(false);
      setIsOrderDetailOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Không thể xử lý yêu cầu trả hàng');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingType, setImportingType] = useState<'products' | 'customers' | null>(null);

  const exportDataToExcel = (data: any[], filename: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importingType) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data.length === 0) {
          toast.error('File không có dữ liệu');
          return;
        }

        if (importingType === 'products') {
          // Format payload
          const payload = data.map((item: any) => ({
            name: item.name || item['Tên sản phẩm'],
            description: item.description || item['Mô tả'],
            price: Number(item.price || item['Giá']) || 0,
            originalPrice: Number(item.originalPrice || item['Giá gốc']) || 0,
            category: item.category || item['Danh mục'],
            unit: item.unit || item['Đơn vị'] || 'bó',
            stock: Number(item.stock || item['Tồn kho']) || 0,
            image: item.image || item['Đường dẫn ảnh'] || 'https://picsum.photos/seed/flower/400/500'
          })).filter((item: any) => item.name);

          if (payload.length === 0) {
            toast.error('Dữ liệu sản phẩm không hợp lệ (cần trường Tên sản phẩm/name)');
            return;
          }

          setLoading(true);
          const res = await api.post('/products/bulk', payload);
          toast.success(`Đã thêm ${res.data.count} sản phẩm`);
          fetchData();

        } else if (importingType === 'customers') {
          const payload = data.map((item: any) => ({
            name: item.name || item['Tên khách hàng'],
            email: item.email || item['Email'],
            phone: item.phone || item['SĐT'] || item['Số điện thoại'],
            address: item.address || item['Địa chỉ'],
            notes: item.notes || item['Ghi chú'],
            isVIP: item.isVIP || item['VIP'] === 'Có' || item['VIP'] === true || false
          })).filter((item: any) => item.name && item.email);

          if (payload.length === 0) {
            toast.error('Dữ liệu khách hàng không hợp lệ (cần trường Tên/name và Email/email)');
            return;
          }

          setLoading(true);
          const res = await api.post('/customers/bulk', payload);
          toast.success(`Đã thêm ${res.data.importedCount} khách hàng (bỏ qua ${res.data.skippedCount} do trùng email)`);
          fetchData();
        }

      } catch (err: any) {
        toast.error('Lỗi khi đọc hoặc xử lý file Excel');
        console.error(err);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
        setImportingType(null);
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'stats') {
        const res = await api.get(`/admin/stats?timeframe=${timeframe}`);
        setStats(res.data);
      } else if (activeTab === 'products') {
        const res = await api.get(`/products?page=${productPage}&limit=10&showHidden=true`);
        setProducts(res.data.items || res.data);
        if (res.data.pagination) setProductTotalPages(res.data.pagination.totalPages || 1);
      } else if (activeTab === 'orders') {
        const res = await api.get(`/orders?page=${orderPage}&limit=10`);
        setOrders(res.data.items || res.data);
        if (res.data.pagination) setOrderTotalPages(res.data.pagination.totalPages || 1);
      } else if (activeTab === 'customers') {
        const res = await api.get('/admin/users');
        setUsers((res.data || []).filter((u: User) => u.role === 'customer'));
      } else if (activeTab === 'staff') {
        const res = await api.get('/admin/users');
        setUsers((res.data || []).filter((u: User) => u.role === 'staff' || u.role === 'shipper'));
      } else if (activeTab === 'settings') {
        const [settingsRes, backupsRes] = await Promise.all([
          api.get('/settings'),
          api.get('/admin/backups').catch(() => ({ data: [] }))
        ]);
        setSiteSettings(settingsRes.data);
        setBackups(backupsRes.data);
      } else if (activeTab === 'inventory') {
        const [prodRes, logRes, supRes] = await Promise.all([
          api.get('/products'),
          api.get('/inventory/logs'),
          api.get('/suppliers')
        ]);
        setProducts(prodRes.data.items || prodRes.data);
        setInventoryLogs(logRes.data);
        setSuppliers(supRes.data);
      } else if (activeTab === 'suppliers') {
        const res = await api.get('/suppliers');
        setSuppliers(res.data);
      } else if (activeTab === 'shifts') {
        const res = await api.get('/shifts');
        setShifts(res.data);
      }
    } catch (err) {
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploading(true);
    
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
        setForm({ ...form, image: reader.result as string });
        setUploading(false);
        toast.success('Tải ảnh lên thành công');
      };
      reader.onerror = () => {
        setUploading(false);
        toast.error('Lỗi khi đọc file ảnh');
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      setUploading(false);
      toast.error('Lỗi khi nén ảnh');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Frontend Validation
    if (!form.name.trim()) {
      return toast.error('Vui lòng nhập tên sản phẩm');
    }
    if (Number(form.price) < 0) {
      return toast.error('Giá bán không được âm');
    }
    if (form.stock === '' || Number(form.stock) < 0) {
      return toast.error('Số lượng tồn kho không hợp lệ');
    }
    if (!form.image) {
      return toast.error('Vui lòng tải ảnh lên hoặc dán link ảnh');
    }

    setLoading(true);
    try {
      const productData: any = {
        name: form.name,
        price: Number(form.price),
        costPrice: Number(form.costPrice) || 0,
        originalPrice: Number(form.originalPrice) || Number(form.price),
        discount: Number(form.discount) || 0,
        isHidden: form.isHidden,
        isStackable: form.isStackable,
        category: form.category,
        occasions: form.occasions,
        color: form.color,
        stock: Number(form.stock),
        image: form.image,
        minStock: Number(form.minStock),
        unit: form.unit
      };

      if (editingProduct) {
        productData.version = editingProduct.version;
        await api.patch(`/products/${editingProduct.id}`, productData);
        toast.success('Cập nhật sản phẩm thành công');
      } else {
        await api.post('/products', productData);
        toast.success('Thêm sản phẩm thành công');
      }
      
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setForm({ name: '', originalPrice: '', discount: '0', isStackable: false, price: '', category: 'Roses', occasions: [], color: '', stock: '', image: '', minStock: '5', unit: 'bó' });
      fetchData();
      if (onProductChange) onProductChange();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = (id: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: 'Xóa sản phẩm',
      message: 'Bạn có chắc chắn muốn xóa sản phẩm này?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/products/${id}`);
          toast.success('Đã xóa sản phẩm');
          fetchData();
          if (onProductChange) onProductChange();
        } catch (err) {
          toast.error('Không thể xóa sản phẩm');
        }
      }
    });
  };

  const handleDeleteOrder = (id: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: 'Xóa đơn hàng',
      message: 'Bạn có chắc chắn muốn xóa đơn hàng này? Thao tác này không thể hoàn tác.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.delete(`/orders/${id}`);
          toast.success('Đã xóa đơn hàng');
          fetchData();
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Không thể xóa đơn hàng');
        }
      }
    });
  };

  const handleUpdateOrderStatus = (id: string, status: string) => {
    const statusText = status === 'confirmed' ? 'Duyệt đơn' : 
                      status === 'processing' ? 'Bắt đầu xử lý' :
                      status === 'ready' ? 'Sẵn sàng giao' :
                      status === 'shipping' ? 'Bắt đầu giao hàng' :
                      status === 'delivered' ? 'Hoàn thành đơn' :
                      status === 'cancelled' ? 'Hủy đơn' : status;

    setGlobalConfirm({
      isOpen: true,
      title: 'Cập nhật trạng thái',
      message: `Bạn có chắc chắn muốn chuyển trạng thái đơn hàng sang "${statusText}" không?`,
      type: status === 'cancelled' ? 'danger' : 'info',
      onConfirm: async () => {
        try {
          const orderToUpdate = orders.find(o => o.id === id) || selectedOrder;
          const res = await api.patch(`/orders/${id}/status`, { 
            status,
            version: orderToUpdate?.__v 
          });
          toast.success('Cập nhật trạng thái thành công');
          if (selectedOrder && selectedOrder.id === id) {
            setSelectedOrder(res.data.order);
          }
          fetchData();
        } catch (err: any) {
          if (err.response?.status === 409) {
            toast.error('Xung đột dữ liệu: Một nhân viên khác đã cập nhật đơn hàng này. Vui lòng tải lại dữ liệu.');
            fetchData();
          } else {
            toast.error('Không thể cập nhật trạng thái');
          }
        }
      }
    });
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.productId) return toast.error('Vui lòng chọn sản phẩm');
    if (Number(importForm.quantity) <= 0) return toast.error('Số lượng nhập phải lớn hơn 0');
    if (Number(importForm.price) < 0) return toast.error('Giá nhập không được âm');

    setLoading(true);
    try {
      await api.post('/inventory/import', importForm);
      toast.success('Nhập kho thành công');
      setImportForm({ productId: '', quantity: '', price: '', supplierId: '', reason: 'Nhập hàng mới' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi nhập kho');
    } finally {
      setLoading(false);
    }
  };

  const handleWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteForm.productId) return toast.error('Vui lòng chọn sản phẩm');
    if (Number(wasteForm.quantity) <= 0) return toast.error('Số lượng xuất hủy phải lớn hơn 0');

    setLoading(true);
    try {
      await api.post('/inventory/waste', wasteForm);
      toast.success('Xuất hủy thành công');
      setWasteForm({ productId: '', quantity: '', reason: 'Hoa héo/dập' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi xuất hủy');
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, supplierForm);
        toast.success('Cập nhật nhà cung cấp thành công');
      } else {
        await api.post('/suppliers', supplierForm);
        toast.success('Thêm nhà cung cấp thành công');
      }
      setSupplierForm({ name: '', phone: '', address: '', email: '', mainCategory: '', productIds: [] });
      setEditingSupplier(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi lưu nhà cung cấp');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = (id: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: 'Xóa nhà cung cấp',
      message: 'Bạn có chắc chắn muốn xóa nhà cung cấp này? Các liên kết mặc định với sản phẩm sẽ bị gỡ bỏ.',
      type: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          await api.delete(`/suppliers/${id}`);
          toast.success('Đã xóa nhà cung cấp');
          fetchData();
          if (editingSupplier?.id === id) {
            setSupplierForm({ name: '', phone: '', address: '', email: '', mainCategory: '', productIds: [] });
            setEditingSupplier(null);
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Không thể xóa nhà cung cấp');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = ticketForm.type === 'import' ? '/inventory/tickets/import' : '/inventory/tickets/export';
      
      const payload = {
        ...ticketForm,
        type: ticketForm.type === 'export' ? 'sale' : ticketForm.type
      };

      await api.post(endpoint, payload);
      toast.success('Tạo phiếu kho thành công');
      setTicketForm({
        type: 'import',
        supplierId: '',
        items: [{ productId: '', quantity: '', importPrice: '' }],
        notes: ''
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi tạo phiếu kho');
    } finally {
      setLoading(false);
    }
  };

  const handleEndShift = (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalConfirm({
      isOpen: true,
      title: 'Kết thúc ca',
      message: 'Bạn có chắc chắn muốn kết thúc ca làm việc và bàn giao tiền?',
      type: 'warning',
      onConfirm: async () => {
        setLoading(true);
        try {
          await api.post('/shifts/end', { 
            actualCashReceived: shiftActionForm.actualCashReceived,
            notes: shiftActionForm.notes
          });
          setActiveShift(null);
          setShiftModal({ isOpen: false, type: 'end' });
          setShiftActionForm({ startCash: '', actualCashReceived: '', notes: '' });
          toast.success('Kết thúc ca làm việc thành công');
          fetchData();
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Lỗi kết thúc ca');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/shifts/start', { startCash: shiftActionForm.startCash });
      setActiveShift(res.data);
      setShiftModal({ isOpen: false, type: 'start' });
      setShiftActionForm({ startCash: '', actualCashReceived: '', notes: '' });
      toast.success('Bắt đầu ca làm việc thành công');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi bắt đầu ca');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUserForm()) return;
    setLoading(true);
    try {
      await api.post('/auth/create-staff', staffForm);
      toast.success('Tạo tài khoản nhân sự thành công');
      setStaffForm({ name: '', email: '', password: '', role: 'staff', permissions: [] });
      setUserFormErrors({});
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tạo tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/admin/users/${editingUser.id}`, editingUser);
      toast.success('Cập nhật người dùng thành công');
      setIsEditUserModalOpen(false);
      setEditingUser(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: 'Xóa người dùng',
      message: 'Bạn có chắc chắn muốn xóa người dùng này?',
      type: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          await api.delete(`/admin/users/${id}`);
          toast.success('Xóa người dùng thành công');
          fetchData();
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Lỗi xóa người dùng');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingCustomer) {
        await api.patch(`/admin/users/${editingCustomer.id}`, customerForm);
        toast.success('Cập nhật khách hàng thành công');
      } else {
        await api.post('/customers', customerForm);
        toast.success('Thêm khách hàng thành công');
      }
      setIsCustomerModalOpen(false);
      setEditingCustomer(null);
      setCustomerForm({ name: '', email: '', phone: '', address: '', notes: '', isVIP: false });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = (id: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: 'Xóa khách hàng',
      message: 'Bạn có chắc chắn muốn xóa khách hàng này?',
      type: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          await api.delete(`/customers/${id}`);
          toast.success('Xóa khách hàng thành công');
          fetchData();
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Lỗi xóa khách hàng');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleResetPassword = (userId: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: 'Đặt lại mật khẩu',
      message: 'Bạn có chắc chắn muốn đặt lại mật khẩu của người này về 123456 không?',
      type: 'info',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await api.patch(`/admin/reset-password/${userId}`);
          toast.success(res.data.message);
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Lỗi đặt lại mật khẩu');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleSettingsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch('/settings', siteSettings);
      toast.success('Cập nhật cấu hình thành công');
      if (onProductChange) onProductChange();
    } catch (err) {
      toast.error('Không thể cập nhật cấu hình');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await api.post('/admin/backups', {});
      toast.success('Tạo bản sao lưu thành công');
      const res = await api.get('/admin/backups');
      setBackups(res.data);
    } catch (err) {
      toast.error('Lỗi khi tạo bản sao lưu');
    } finally {
      setLoading(false);
    }
  };

  const renderSettings = () => (
    <div className="max-w-2xl space-y-8">
      <div className="bg-white p-10 rounded-[40px] border border-stone-100 shadow-sm">
        <h3 className="font-serif text-2xl mb-8">Cấu hình Trang chủ</h3>
        <form onSubmit={handleSettingsUpdate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Ảnh Hero (Trang chủ)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <input 
                  type="file" 
                  accept="image/*"
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

                    setUploading(true);
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
                        setSiteSettings({ ...siteSettings, heroImage: reader.result as string });
                        toast.success('Đã tải ảnh lên');
                        setUploading(false);
                      };
                      reader.onerror = () => {
                        toast.error('Lỗi tải ảnh');
                        setUploading(false);
                      };
                      reader.readAsDataURL(compressedFile);
                    } catch (err) {
                      setUploading(false);
                      toast.error('Lỗi khi nén ảnh');
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-stone-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-2 bg-stone-50">
                  {uploading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black" /> : <Upload size={24} className="text-stone-400" />}
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest">Đổi ảnh Hero</span>
                </div>
              </div>
              <input 
                type="text" 
                placeholder="Hoặc dán URL ảnh..."
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={siteSettings.heroImage}
                onChange={e => setSiteSettings({ ...siteSettings, heroImage: e.target.value })}
              />
            </div>
            {siteSettings.heroImage && (
              <div className="mt-4 aspect-video rounded-2xl overflow-hidden border border-stone-100">
                <img src={siteSettings.heroImage} alt="Hero Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Tiêu đề Hero</label>
            <input 
              type="text" 
              className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
              value={siteSettings.heroTitle}
              onChange={e => setSiteSettings({ ...siteSettings, heroTitle: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Mô tả Hero</label>
            <textarea 
              rows={3}
              className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
              value={siteSettings.heroSubtitle}
              onChange={e => setSiteSettings({ ...siteSettings, heroSubtitle: e.target.value })}
            />
          </div>

          <div className="pt-6 border-t border-stone-50 space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-stone-800">Thông tin Liên hệ & MXH</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Hotline</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                  value={siteSettings.hotline}
                  onChange={e => setSiteSettings({ ...siteSettings, hotline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Số Zalo</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                  value={siteSettings.zalo}
                  onChange={e => setSiteSettings({ ...siteSettings, zalo: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Địa chỉ cửa hàng</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                  value={siteSettings.address}
                  onChange={e => setSiteSettings({ ...siteSettings, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Facebook URL</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                  value={siteSettings.facebook}
                  onChange={e => setSiteSettings({ ...siteSettings, facebook: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Instagram URL</label>
                <input 
                  type="text" 
                  className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                  value={siteSettings.instagram}
                  onChange={e => setSiteSettings({ ...siteSettings, instagram: e.target.value })}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || uploading}
            className="w-full bg-black text-white py-5 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </form>
      </div>

      <div className="bg-white p-10 rounded-[40px] border border-stone-100 shadow-sm">
        <h3 className="font-serif text-2xl mb-8">Cấu hình Thanh toán</h3>
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              await api.put('/settings/payment', {
                bankName: siteSettings.bankName,
                accountNumber: siteSettings.accountNumber,
                accountHolder: siteSettings.accountHolder,
                momoPhone: siteSettings.momoPhone
              });
              toast.success('Cập nhật thông tin thanh toán thành công');
            } catch (err) {
              toast.error('Lỗi khi cập nhật thông tin thành toán');
            } finally {
              setLoading(false);
            }
          }} 
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Tên ngân hàng (e.g. MB Bank)</label>
              <input 
                type="text" 
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={siteSettings.bankName}
                onChange={e => setSiteSettings({ ...siteSettings, bankName: e.target.value })}
                placeholder="Ví dụ: MB Bank, Vietcombank..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Số tài khoản</label>
              <input 
                type="text" 
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={siteSettings.accountNumber}
                onChange={e => setSiteSettings({ ...siteSettings, accountNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Tên chủ tài khoản</label>
              <input 
                type="text" 
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={siteSettings.accountHolder}
                onChange={e => setSiteSettings({ ...siteSettings, accountHolder: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Số điện thoại MoMo</label>
              <input 
                type="text" 
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={siteSettings.momoPhone}
                onChange={e => setSiteSettings({ ...siteSettings, momoPhone: e.target.value })}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-5 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : 'Lưu cấu hình thanh toán'}
          </button>
        </form>
      </div>

      <div className="bg-white p-10 rounded-[40px] border border-stone-100 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-serif text-2xl">Bản Sao Lưu (Backup)</h3>
            <p className="text-stone-400 text-sm mt-1">Hệ thống tự động sao lưu 1 lần/ngày. Bạn cũng có thể tạo thủ công.</p>
          </div>
          <button 
            onClick={handleCreateBackup}
            disabled={loading}
            className="bg-black text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
          >
            Tạo bản sao lưu ngay
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            Chưa có bản sao lưu nào
          </div>
        ) : (
          <div className="space-y-4">
            {backups.map((b: any, idx) => (
              <div key={idx} className="flex justify-between items-center p-4 bg-stone-50 rounded-2xl">
                <div>
                  <p className="font-medium text-sm font-mono">{b.filename}</p>
                  <p className="text-xs text-stone-500 mt-1">
                    {new Date(b.createdAt).toLocaleString('vi-VN')} • {(b.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Logic to download or notify (In real env, would link to file)
                    toast('Bản sao lưu lưu trữ an toàn trong /backups', { icon: '📊' });
                  }}
                  className="px-4 py-2 bg-white border border-stone-200 rounded-xl text-xs font-medium hover:bg-stone-50 transition-colors"
                >
                  Chi tiết
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStats = () => {
    if (!stats) return null;
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm">
          <div>
            <h3 className="font-serif text-2xl">Tổng quan {timeframe === 'day' ? 'Hôm nay' : timeframe === 'month' ? 'Tháng này' : 'Năm nay'}</h3>
            <p className="text-stone-400 text-sm mt-1">Cập nhật lúc {new Date().toLocaleTimeString('vi-VN')}</p>
          </div>
          <button 
            onClick={() => {
              const overview = [{
                'Thời gian': timeframe,
                'Doanh thu': stats.totalRevenue,
                'Lợi nhuận': stats.totalProfit || 0,
                'Tổng đơn hàng': stats.totalOrders,
                'Đơn chờ duyệt': stats.pendingOrders,
                'Số lượng khách hàng': stats.totalCustomers
              }];
              
              // We'll export the overview only since charts are visuals
              exportDataToExcel(overview, `ThongKe_${timeframe}_${Date.now()}`);
            }}
            className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-sm"
          >
            Xuất Báo Cáo
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[
            { label: 'Doanh thu', value: `${stats.totalRevenue.toLocaleString('vi-VN')}đ`, icon: DollarSign, color: 'bg-green-50 text-green-600' },
            { label: 'Lợi nhuận', value: `${(stats.totalProfit || 0).toLocaleString('vi-VN')}đ`, icon: PackageCheck, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Tổng đơn hàng', value: stats.totalOrders, icon: ShoppingBag, color: 'bg-blue-50 text-blue-600' },
            { label: 'Đơn chờ duyệt', value: stats.pendingOrders, icon: Clock, color: 'bg-amber-50 text-amber-600' },
            { label: 'Khách hàng', value: stats.totalCustomers, icon: Users, color: 'bg-purple-50 text-purple-600' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-2xl ${item.color} flex items-center justify-center`}>
                <item.icon size={24} />
              </div>
              <div>
                <p className="text-stone-400 text-[10px] uppercase tracking-widest font-bold">{item.label}</p>
                <p className="text-2xl font-serif">{item.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <h3 className="font-serif text-2xl">Doanh thu</h3>
                <select 
                  className="bg-stone-50 border-none text-sm font-bold text-stone-600 rounded-xl px-4 py-2 focus:ring-black"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                >
                  <option value="day">7 ngày qua</option>
                  <option value="week">4 tuần qua</option>
                  <option value="month">6 tháng qua</option>
                  <option value="year">3 năm qua</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-stone-400 text-xs">
                <div className="w-3 h-3 rounded-full bg-black" />
                <span>Doanh thu (VNĐ)</span>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.revenueChart}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#a8a29e' }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#a8a29e' }}
                    tickFormatter={(val) => `${val/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: any) => [Number(val || 0).toLocaleString('vi-VN') + 'đ', 'Doanh thu']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#000" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-black text-white p-8 rounded-[40px] flex flex-col justify-between">
            <div>
              <h3 className="font-serif text-3xl italic mb-4">Midnight Rose</h3>
              <p className="text-stone-400 text-sm leading-relaxed">
                Hệ thống quản trị cao cấp dành cho nghệ nhân hoa. 
                Theo dõi sát sao từng đơn hàng để đảm bảo trải nghiệm tốt nhất cho khách hàng.
              </p>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-stone-900 rounded-2xl flex items-center justify-between">
                <span className="text-xs text-stone-400">Tỷ lệ hoàn thành</span>
                <span className="font-bold">98.5%</span>
              </div>
              <div className="p-4 bg-stone-900 rounded-2xl flex items-center justify-between">
                <span className="text-xs text-stone-400">Thời gian giao TB</span>
                <span className="font-bold">45 phút</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top/Worst Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm">
            <h3 className="font-serif text-2xl mb-6">Sản phẩm bán chạy</h3>
            <div className="space-y-4">
              {stats.topProducts && stats.topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-stone-50 rounded-2xl">
                  <div>
                    <p className="font-bold text-sm">{p.name}</p>
                    <p className="text-xs text-stone-500">Đã bán: {p.quantity}</p>
                  </div>
                  <p className="font-bold text-green-600">{p.revenue.toLocaleString('vi-VN')}đ</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-8 rounded-[40px] border border-stone-100 shadow-sm">
            <h3 className="font-serif text-2xl mb-6">Sản phẩm bán ế</h3>
            <div className="space-y-4">
              {stats.worstProducts && stats.worstProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-stone-50 rounded-2xl">
                  <div>
                    <p className="font-bold text-sm">{p.name}</p>
                    <p className="text-xs text-stone-500">Đã bán: {p.quantity}</p>
                  </div>
                  <p className="font-bold text-red-600">{p.revenue.toLocaleString('vi-VN')}đ</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInventory = () => (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lập Phiếu Kho */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[40px] border border-stone-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center">
                <Warehouse size={20} />
              </div>
              <h4 className="font-serif text-xl">Lập Phiếu Kho Hàng</h4>
            </div>
            <div className="flex bg-stone-50 p-1 rounded-2xl">
              {(['import', 'export', 'waste'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTicketForm({ ...ticketForm, type })}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    ticketForm.type === type ? 'bg-black text-white shadow-lg' : 'text-stone-400 hover:text-black'
                  }`}
                >
                  {type === 'import' ? 'Nhập' : type === 'export' ? 'Xuất' : 'Hủy'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleTicketSubmit} className="space-y-8">
            {ticketForm.type === 'import' && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Chọn Nhà cung cấp</label>
                <select 
                  required
                  className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                  value={ticketForm.supplierId}
                  onChange={e => setTicketForm({...ticketForm, supplierId: e.target.value})}
                >
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.mainCategory})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Danh sách sản phẩm</label>
                <button 
                  type="button"
                  onClick={() => setTicketForm({ ...ticketForm, items: [...ticketForm.items, { productId: '', quantity: '', importPrice: '' }] })}
                  className="text-[10px] uppercase font-bold text-black flex items-center gap-1 hover:underline"
                >
                  <Plus size={14} /> Thêm dòng
                </button>
              </div>

              <div className="space-y-3">
                {ticketForm.items.map((item, idx) => {
                  // Filter products if supplier is selected in import mode
                  const filteredProducts = ticketForm.type === 'import' && ticketForm.supplierId 
                    ? products.filter(p => !p.supplierId || p.supplierId === ticketForm.supplierId)
                    : products;

                  return (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <select 
                          required
                          className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                          value={item.productId}
                          onChange={e => {
                            const newItems = [...ticketForm.items];
                            newItems[idx].productId = e.target.value;
                            setTicketForm({ ...ticketForm, items: newItems });
                          }}
                        >
                          <option value="">-- Sản phẩm --</option>
                          {filteredProducts.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Hãng: {p.category})</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24 space-y-1">
                        <input 
                          type="number" 
                          required
                          placeholder="SL"
                          className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                          value={item.quantity}
                          onChange={e => {
                            const newItems = [...ticketForm.items];
                            newItems[idx].quantity = e.target.value;
                            setTicketForm({ ...ticketForm, items: newItems });
                          }}
                        />
                      </div>
                      {ticketForm.type === 'import' && (
                        <div className="w-32 space-y-1">
                          <input 
                            type="number" 
                            required
                            placeholder="Giá nhập"
                            className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                            value={item.importPrice}
                            onChange={e => {
                              const newItems = [...ticketForm.items];
                              newItems[idx].importPrice = e.target.value;
                              setTicketForm({ ...ticketForm, items: newItems });
                            }}
                          />
                        </div>
                      )}
                      <button 
                        type="button"
                        onClick={() => {
                          const newItems = ticketForm.items.filter((_, i) => i !== idx);
                          setTicketForm({ ...ticketForm, items: newItems.length ? newItems : [{ productId: '', quantity: '', importPrice: '' }] });
                        }}
                        className="p-4 text-stone-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Ghi chú phiếu</label>
              <textarea 
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={ticketForm.notes}
                onChange={e => setTicketForm({...ticketForm, notes: e.target.value})}
                rows={2}
                placeholder="VD: Nhập hàng Tết, Xuất hủy do hỏng..."
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-black text-white py-5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 shadow-xl"
            >
              {loading ? 'Đang xử lý...' : `Xác nhận ${ticketForm.type === 'import' ? 'nhập' : ticketForm.type === 'export' ? 'xuất' : 'hủy'} kho`}
            </button>
          </form>
        </div>

        {/* Quick Review */}
        <div className="space-y-8">
          <div className="bg-black text-white p-10 rounded-[40px] flex flex-col justify-between h-full">
            <div>
              <h4 className="font-serif text-2xl italic mb-6">Tóm tắt Phiếu</h4>
              <div className="space-y-4">
                <div className="flex justify-between border-b border-stone-800 pb-4">
                  <span className="text-stone-400 text-[10px] uppercase tracking-widest">Loại</span>
                  <span className="font-bold uppercase tracking-widest">{ticketForm.type}</span>
                </div>
                <div className="flex justify-between border-b border-stone-800 pb-4">
                  <span className="text-stone-400 text-[10px] uppercase tracking-widest">Sản phẩm</span>
                  <span className="font-bold">{ticketForm.items.filter(i => i.productId).length} loại</span>
                </div>
                <div className="flex justify-between border-b border-stone-800 pb-4">
                  <span className="text-stone-400 text-[10px] uppercase tracking-widest">Số lượng</span>
                  <span className="font-bold">{ticketForm.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0)}</span>
                </div>
                {ticketForm.type === 'import' && (
                  <div className="pt-4">
                    <span className="text-stone-400 text-[10px] uppercase tracking-widest block mb-2">Giá trị ước tính</span>
                    <p className="text-3xl font-serif text-green-400">
                      {ticketForm.items.reduce((sum, i) => sum + (Number(i.quantity || 0) * Number(i.importPrice || 0)), 0).toLocaleString()}đ
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-12 p-6 bg-stone-900 rounded-3xl">
              <p className="text-[10px] text-stone-500 leading-relaxed italic">
                * Phiếu kho sẽ tự động cập nhật số lượng tồn kho và lưu vết nhật ký ngay khi bạn nhấn xác nhận.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Nhật ký kho hàng */}
      <div className="bg-white rounded-[40px] border border-stone-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div className="flex items-center gap-3">
            <ClipboardList size={20} className="text-stone-400" />
            <span className="font-serif text-lg">Nhật ký kho (Gần đây)</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Thời gian</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Loại</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Sản phẩm</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">SL</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Nhà CC</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Lý do</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Người thực hiện</th>
              </tr>
            </thead>
            <tbody>
              {inventoryLogs.map((log) => (
                <tr key={log.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                  <td className="p-6 text-[10px] text-stone-400">
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                      log.type === 'import' ? 'bg-green-50 text-green-600' :
                      log.type === 'waste' ? 'bg-red-50 text-red-600' :
                      'bg-stone-50 text-stone-600'
                    }`}>
                      {log.type === 'import' ? 'Nhập' : log.type === 'waste' ? 'Hủy' : 'Xuất'}
                    </span>
                  </td>
                  <td className="p-6 font-medium text-sm">{log.productName}</td>
                  <td className="p-6 font-bold text-sm">
                    {log.type === 'import' ? '+' : '-'}{log.quantity}
                  </td>
                  <td className="p-6 text-xs text-stone-500">{log.supplierName || '-'}</td>
                  <td className="p-6 text-xs text-stone-400 italic">{log.reason}</td>
                  <td className="p-6 text-xs font-medium">{log.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSuppliers = () => (
    <div className="space-y-12">
      <div className="bg-white p-10 rounded-[40px] border border-stone-100 shadow-sm max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center">
              <Factory size={20} />
            </div>
            <h4 className="font-serif text-xl">
              {editingSupplier ? 'Cập Nhật Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}
            </h4>
          </div>
          {editingSupplier && (
            <button 
              onClick={() => {
                setEditingSupplier(null);
                setSupplierForm({ name: '', phone: '', address: '', email: '', mainCategory: '', productIds: [] });
              }}
              className="text-xs uppercase tracking-widest font-bold text-stone-400 hover:text-black transition-colors"
            >
              Hủy chỉnh sửa
            </button>
          )}
        </div>
        <form onSubmit={handleSupplierSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Tên NCC</label>
              <input 
                type="text" 
                required
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={supplierForm.name}
                onChange={e => setSupplierForm({...supplierForm, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Số điện thoại</label>
              <input 
                type="text" 
                required
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={supplierForm.phone}
                onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Email</label>
              <input 
                type="email" 
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={supplierForm.email}
                onChange={e => setSupplierForm({...supplierForm, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Hạng mục hoa chính</label>
              <input 
                type="text" 
                placeholder="VD: Hoa hồng Đà Lạt, Hoa nhập khẩu..."
                className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                value={supplierForm.mainCategory}
                onChange={e => setSupplierForm({...supplierForm, mainCategory: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Địa chỉ</label>
            <input 
              type="text" 
              className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
              value={supplierForm.address}
              onChange={e => setSupplierForm({...supplierForm, address: e.target.value})}
            />
          </div>
          <div className="space-y-4">
            <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Gắn sản phẩm cung cấp mặc định</label>
            <div className="flex flex-wrap gap-2 p-4 bg-stone-50 rounded-2xl min-h-[60px]">
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const exists = supplierForm.productIds.includes(p.id);
                    if (exists) {
                      setSupplierForm({ ...supplierForm, productIds: supplierForm.productIds.filter(id => id !== p.id) });
                    } else {
                      setSupplierForm({ ...supplierForm, productIds: [...supplierForm.productIds, p.id] });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                    supplierForm.productIds.includes(p.id) ? 'bg-black text-white' : 'bg-white text-stone-400 border border-stone-100 hover:border-black hover:text-black'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <p className="text-[8px] text-stone-400 italic">Việc chọn sản phẩm ở đây sẽ cập nhật 'Nhà cung cấp' mặc định cho sản phẩm đó khi lưu.</p>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white py-5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
          >
            {editingSupplier ? 'Cập nhật nhà cung cấp' : 'Lưu nhà cung cấp'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.map((s) => (
          <div 
            key={s.id} 
            onClick={() => {
              setEditingSupplier(s);
              setSupplierForm({
                name: s.name,
                phone: s.phone || '',
                address: s.address || '',
                email: s.email || '',
                mainCategory: s.mainCategory || '',
                productIds: products.filter(p => p.supplierId === s._id || p.supplierId === s.id).map(p => p.id)
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`group cursor-pointer bg-white p-8 rounded-[40px] border transition-all relative ${
              editingSupplier?.id === s.id ? 'border-black ring-1 ring-black' : 'border-stone-100 hover:border-stone-300'
            }`}
          >
            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingSupplier(s);
                  setSupplierForm({
                    name: s.name,
                    phone: s.phone || '',
                    address: s.address || '',
                    email: s.email || '',
                    mainCategory: s.mainCategory || '',
                    productIds: products.filter(p => p.supplierId === s._id || p.supplierId === s.id).map(p => p.id)
                  });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-2 bg-stone-100 rounded-full hover:bg-black hover:text-white transition-colors"
                title="Sửa"
              >
                <Pencil size={12} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSupplier(s.id);
                }}
                className="p-2 bg-stone-100 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                title="Xóa"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <h5 className="font-serif text-xl font-bold mb-4">{s.name}</h5>
            <div className="space-y-2 text-sm text-stone-500">
              <p className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-black" /> {s.phone}</p>
              {s.email && <p className="flex items-center gap-2 font-medium text-black underline">{s.email}</p>}
              {s.address && <p className="text-xs italic">{s.address}</p>}
            </div>
            <div className="pt-4 border-t border-stone-50">
              <span className="text-[10px] uppercase font-bold tracking-widest text-stone-400">Cung cấp: </span>
              <span className="text-[10px] uppercase font-bold text-black">{s.mainCategory || 'Chưa phân loại'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-serif text-2xl">Quản lý sản phẩm</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              const formatted = products.map(p => ({
                'ID': p.id,
                'Tên sản phẩm': p.name,
                'Danh mục': p.category,
                'Số lượng tồn': p.stock,
                'Đơn vị': p.unit || 'bó',
                'Giá gốc': p.originalPrice || p.price,
                'Giá bán': p.price,
                'Chi phí vốn': p.costPrice || 0,
                'Nhà cung cấp': products.find(prod => prod.id === p.id)?.supplierId || 'Không có', // Note: better if we had supplier name, but this works
                'Trạng thái': p.isHidden ? 'Đã ẩn' : 'Đang bán'
              }));
              exportDataToExcel(formatted, 'DanhSachSanPham');
            }}
            className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-sm"
          >
            Xuất Excel
          </button>
          {isAdmin && (
            <>
              <button 
                onClick={() => {
                  setImportingType('products');
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                Nhập Excel
              </button>
              <button 
                onClick={() => {
                  setEditingProduct(null);
                  setForm({ name: '', originalPrice: '', discount: '0', isStackable: false, price: '', costPrice: '0', category: 'Roses', occasions: [], color: '', stock: '', image: '', minStock: '5', unit: 'bó', isHidden: false });
                  setIsProductModalOpen(true);
                }}
                className="bg-black text-white px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-stone-800 transition-all"
              >
                <Plus size={16} />
                Thêm sản phẩm
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-stone-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100">
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Sản phẩm</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Danh mục</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Giá</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Tồn kho</th>
                {isAdmin && <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {Array.isArray(products) && products.map((product) => (
                <tr key={product.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100">
                        <img src={product.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <span className="font-medium text-sm">{product.name}</span>
                    </div>
                  </td>
                  <td className="p-6 text-sm text-stone-500">
                    <div className="flex flex-col gap-1 items-start">
                      <span>{product.category}</span>
                      {(product as any).isHidden && (
                        <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[8px] font-bold uppercase tracking-widest border border-stone-200">
                          Đang ẩn
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-6 text-sm font-bold">
                    <div className="flex items-center gap-2">
                      {product.price.toLocaleString('vi-VN')}đ
                      {isAdmin && (
                        <button 
                          onClick={() => {
                            setSelectedProductHistory(product);
                            setIsHistoryModalOpen(true);
                          }}
                          className="p-1.5 text-stone-300 hover:text-black hover:bg-stone-50 rounded-lg transition-all"
                          title="Lịch sử giá"
                        >
                          <History size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      product.stock === 0 ? 'bg-red-100 text-red-600' :
                      product.stock <= (product.minStock || 5) ? 'bg-amber-100 text-amber-600' : 
                      'bg-green-50 text-green-600'
                    }`}>
                      {product.stock === 0 ? 'Hết hàng' : 
                       product.stock <= (product.minStock || 5) ? 'Sắp hết' : 'Còn hàng'} 
                      ({product.stock} {product.unit || 'bó'})
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setForm({
                              name: product.name,
                              originalPrice: product.originalPrice?.toString() || '',
                              discount: product.discount?.toString() || '0',
                              isStackable: product.isStackable || false,
                              price: product.price.toString(),
                              costPrice: (product as any).costPrice?.toString() || '0',
                              category: product.category,
                              occasions: product.occasions || [],
                              color: product.color || '',
                              stock: product.stock.toString(),
                              image: product.image,
                              minStock: (product.minStock || 5).toString(),
                              unit: product.unit || 'bó',
                              isHidden: (product as any).isHidden || false
                            });
                            setIsProductModalOpen(true);
                          }}
                          className="p-2 text-stone-400 hover:text-black hover:bg-stone-100 rounded-lg transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {productTotalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button 
            disabled={productPage === 1}
            onClick={() => setProductPage(p => p - 1)}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 disabled:opacity-50 hover:bg-stone-200 transition-all"
          >
            Trang trước
          </button>
          <span className="text-sm font-medium text-stone-500">
            Trang {productPage} / {productTotalPages}
          </span>
          <button 
            disabled={productPage === productTotalPages}
            onClick={() => setProductPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 disabled:opacity-50 hover:bg-stone-200 transition-all"
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );

  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'shipping' | 'delivered' | 'returned'>('all');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  
  const renderOrders = () => {
    const statusTabs = [
      { id: 'all', label: 'Tất cả' },
      { id: 'pending', label: 'Chờ duyệt' },
      { id: 'confirmed', label: 'Đã xác nhận' },
      { id: 'processing', label: 'Đang thực hiện' },
      { id: 'ready', label: 'Sẵn sàng' },
      { id: 'shipping', label: 'Đang giao' },
      { id: 'delivered', label: 'Hoàn thành' },
      { id: 'returned', label: 'Trả hàng' },
      { id: 'cancelled', label: 'Đã hủy' },
    ];

    const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
      const matchesStatus = orderStatusFilter === 'all' 
        ? true 
        : orderStatusFilter === 'returned'
          ? (order.status === 'returned' || order.returnStatus !== 'None')
          : order.status === orderStatusFilter;
          
      const searchLower = orderSearchTerm.toLowerCase();
      const matchesSearch = !orderSearchTerm || (
        order.id.toLowerCase().includes(searchLower) ||
        (order.address?.street || '').toLowerCase().includes(searchLower) ||
        (order.address?.ward || '').toLowerCase().includes(searchLower) ||
        (order.address?.district || '').toLowerCase().includes(searchLower)
      );
      
      return matchesStatus && matchesSearch;
    }) : [];

    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-8">
          <div className="flex-grow flex items-center bg-white border border-stone-200 rounded-2xl px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-black/5 transition-all">
            <Search className="text-stone-400 mr-3" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã đơn, địa chỉ hoặc tên khách hàng..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm placeholder:text-stone-400"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="flex items-center gap-2 bg-white border border-stone-200 hover:border-stone-300 px-4 py-2.5 rounded-2xl text-xs font-bold text-stone-700 transition-all shadow-sm"
              >
                <Filter size={16} className="text-stone-400" />
                {orderStatusFilter === 'all' ? 'Lọc theo trạng thái' : `Trạng thái: ${statusTabs.find(t => t.id === orderStatusFilter)?.label}`}
                <ChevronDown size={14} className={`text-stone-400 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isStatusDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsStatusDropdownOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-56 bg-white border border-stone-100 rounded-3xl shadow-2xl z-20 py-3 overflow-hidden"
                    >
                      {statusTabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setOrderStatusFilter(tab.id as any);
                            setIsStatusDropdownOpen(false);
                          }}
                          className={`w-full text-left px-6 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                            orderStatusFilter === tab.id ? 'bg-black text-white' : 'text-stone-500 hover:bg-stone-50 hover:text-black'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => {
                const formatted = filteredOrders.map(o => ({
                  'Mã Đơn': o.id,
                  'Khách hàng': typeof o.user === 'object' ? o.user?.name : o.user,
                  'SĐT': o.shippingAddress?.phone,
                  'Địa chỉ': o.shippingAddress?.address,
                  'Trạng thái': o.status,
                  'Sản phẩm': o.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', '),
                  'Tổng tiền': o.totalAmount,
                  'Mã giảm': o.discountCode || 'Không',
                  'Ghi chú': o.notes,
                  'Ngày tạo': new Date(o.createdAt).toLocaleString('vi-VN')
                }));
                exportDataToExcel(formatted, 'DanhSachDonHang');
              }}
              className="flex items-center gap-2 bg-white border border-stone-200 hover:border-stone-300 text-stone-700 px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm group"
            >
              <FileDown size={16} className="text-stone-400 group-hover:text-black transition-colors" />
              <span>Xuất Excel</span>
            </button>

            <button 
              className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg active:scale-95"
              onClick={() => toast.success('Tính năng thêm đơn hàng thủ công sẽ được cập nhật sớm!')}
            >
              <Plus size={16} />
              <span>Thêm mới</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[40px] border border-stone-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100">
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 w-[100px]">Mã đơn</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Khách hàng</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 w-[140px]">Ngày giao</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 w-[120px]">Tổng tiền</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 w-[140px]">Thanh toán</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 w-[180px]">Trạng thái</th>
                  <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 w-[100px]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                <tr key={order.id} className={`border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors ${order.returnStatus === 'Requested' ? 'bg-amber-50/50' : ''}`}>
                  <td className="p-6 font-mono text-xs font-bold">
                    #{order.id.slice(-6).toUpperCase()}
                    {order.returnStatus === 'Requested' && (
                      <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] rounded-full animate-pulse">Cần xử lý trả hàng</span>
                    )}
                  </td>
                  <td className="p-6">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{order.address.street}</p>
                      <p className="text-[10px] text-stone-400 uppercase tracking-widest">{order.address.ward}, {order.address.district}</p>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="space-y-1">
                      <p className="text-xs font-bold">{order.deliveryDate}</p>
                      <p className="text-[10px] text-stone-400">{order.deliveryTime}</p>
                    </div>
                  </td>
                  <td className="p-6 text-sm font-bold">{order.totalAmount.toLocaleString('vi-VN')}đ</td>
                  <td className="p-6">
                    <div className="flex flex-col gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${(order as any).paymentMethod === 'Bank' || (order as any).paymentMethod === 'MoMo' ? 'text-blue-600' : 'text-stone-500'}`}>
                        {(order as any).paymentMethod === 'COD' ? 'Tiền mặt' : (order as any).paymentMethod === 'Bank' ? 'Chuyển khoản' : 'MoMo'}
                      </span>
                      {(order as any).paymentMethod !== 'COD' && !(order as any).isPaid && (
                        <button
                          onClick={async () => {
                            try {
                              await api.post(`/orders/${order.id}/confirm-payment`);
                              toast.success('Đã xác nhận thanh toán');
                              fetchData();
                            } catch (err: any) {
                              toast.error(err.response?.data?.message || 'Lỗi xác nhận thanh toán');
                            }
                          }}
                          className="px-2 py-1 text-[8px] uppercase tracking-widest font-bold bg-green-500 text-white rounded-md hover:bg-green-600 w-max"
                        >
                          Xác nhận TT
                        </button>
                      )}
                      {(order as any).isPaid && (
                        <span className="px-2 py-1 text-[8px] uppercase tracking-widest font-bold bg-green-50 text-green-600 border border-green-200 rounded-md w-max">
                          Đã thanh toán
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      order.status === 'delivered' || order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'shipping' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'ready' ? 'bg-indigo-100 text-indigo-700' :
                      order.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                      order.status === 'confirmed' ? 'bg-purple-100 text-purple-700' :
                      order.status === 'cancelled' || order.status === 'failed' ? 'bg-red-100 text-red-700' :
                      order.status === 'returned' ? 'bg-orange-100 text-orange-700' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {order.status === 'pending' ? 'Chờ duyệt' :
                       order.status === 'confirmed' ? 'Đã duyệt' :
                       order.status === 'processing' ? 'Đang thực hiện' :
                       order.status === 'ready' ? 'Sẵn sàng' :
                       order.status === 'shipping' ? 'Đang giao' :
                       order.status === 'delivered' || order.status === 'completed' ? 'Hoàn thành' :
                       order.status === 'returned' ? 'Trả hàng' :
                       order.status === 'cancelled' ? 'Đã hủy' : order.status}
                    </span>
                    <OrderStepper 
                      status={order.status} 
                      role={user?.role || 'staff'} 
                      statusHistory={order.statusHistory}
                      reason={order.status === 'cancelled' || order.status === 'failed' ? order.failedReason : (order.status === 'returned' || order.status === 'refunded') ? order.returnReason : undefined}
                      onStatusUpdate={(newStatus) => handleUpdateOrderStatus(order.id, newStatus)} 
                    />
                  </td>
                  <td className="p-6">
                    <button 
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsOrderDetailOpen(true);
                      }}
                      className="p-2 text-stone-400 hover:text-black hover:bg-stone-100 rounded-lg transition-all"
                      title="Xem chi tiết"
                    >
                      <ExternalLink size={18} />
                    </button>
                    {(order.status === 'delivered' || order.status === 'completed' || order.returnStatus !== 'None') && (
                      <button 
                        onClick={() => {
                          setSelectedOrder(order);
                          setReturnHandleForm({
                            status: order.returnStatus === 'Requested' ? 'Approved' : 'Approved',
                            refundAmount: order.totalAmount,
                            restock: true
                          });
                          setIsReturnHandleOpen(true);
                        }}
                        className={`p-2 rounded-lg transition-all ml-1 ${
                          order.returnStatus === 'Requested' 
                            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                            : 'text-stone-400 hover:text-orange-600 hover:bg-orange-50'
                        }`}
                        title="Xử lý trả hàng/hoàn tiền"
                      >
                        <RotateCcw size={18} />
                      </button>
                    )}
                    {['pending', 'confirmed', 'processing', 'ready'].includes(order.status) && (
                      <button 
                        onClick={() => {
                          setSelectedOrder(order);
                          setEditForm({
                            street: order.address.street,
                            ward: order.address.ward,
                            district: order.address.district,
                            cardMessage: order.cardMessage || ''
                          });
                          setIsEditOrderOpen(true);
                        }}
                        className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all ml-1"
                        title="Chỉnh sửa thông tin"
                      >
                        <Edit3 size={18} />
                      </button>
                    )}
                    {(isAdmin || user?.permissions?.includes('delete_data')) && (
                      <button 
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-1"
                        title="Xóa đơn hàng"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {orderTotalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button 
            disabled={orderPage === 1}
            onClick={() => setOrderPage(p => p - 1)}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 disabled:opacity-50 hover:bg-stone-200 transition-all"
          >
            Trang trước
          </button>
          <span className="text-sm font-medium text-stone-500">
            Trang {orderPage} / {orderTotalPages}
          </span>
          <button 
            disabled={orderPage === orderTotalPages}
            onClick={() => setOrderPage(p => p + 1)}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 disabled:opacity-50 hover:bg-stone-200 transition-all"
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
};

  const renderShifts = () => {
    const isStaffOrShipper = user?.role === 'staff' || user?.role === 'shipper';

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h3 className="font-serif text-3xl">Đối soát & Ca làm việc</h3>
            <p className="text-stone-400 text-xs mt-1">Quản lý dòng tiền và hiệu suất làm việc cá nhân</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
              <AlertCircle size={14} />
              Highlight đỏ: Ca bị lệch tiền
            </div>
          )}
        </div>

        {/* Active Shift Card - Only for performers */}
        {isStaffOrShipper && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`col-span-1 md:col-span-2 p-8 rounded-[40px] border relative overflow-hidden transition-all duration-500 ${
              activeShift ? 'bg-black text-white border-black' : 'bg-white border-stone-100 shadow-sm'
            }`}>
              <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className={`text-[10px] uppercase tracking-[0.2em] font-bold mb-1 ${activeShift ? 'text-stone-400' : 'text-stone-300'}`}>
                      Trạng thái hiện tại
                    </h4>
                    <p className={`font-serif text-2xl ${activeShift ? 'text-white' : 'text-stone-800'}`}>
                      {activeShift ? 'Đang trong ca làm việc' : 'Nghỉ ca / Chưa bắt đầu'}
                    </p>
                  </div>
                  {activeShift && (
                    <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse">
                      LIVE
                    </div>
                  )}
                </div>

                {activeShift ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <span className="text-[10px] text-stone-500 block mb-1">Bắt đầu lúc</span>
                      <span className="text-sm font-medium">{activeShift?.startTime ? new Date(activeShift.startTime).toLocaleTimeString() : '--:--'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-500 block mb-1">Tiền quầy bắt đầu</span>
                      <span className="text-sm font-medium">{(activeShift?.startCash || 0).toLocaleString()}đ</span>
                    </div>
                    <div className="col-span-2">
                       <span className="text-[10px] text-stone-500 block mb-1">Gợi ý đối soát (Tạm tính)</span>
                       <span className="text-xl font-bold text-green-400">? đ</span>
                       <p className="text-[8px] text-stone-500 mt-1 italic">Hệ thống sẽ tổng kết chính xác khi đóng ca</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 max-w-sm">
                    Vui lòng bắt đầu ca mới để hệ thống ghi nhận các đơn hàng bạn xử lý và hỗ trợ đối soát tiền mặt cuối ngày.
                  </p>
                )}

                <div className="flex gap-3">
                  {activeShift ? (
                    <button 
                      onClick={() => setShiftModal({ isOpen: true, type: 'end' })}
                      className="bg-white text-black px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 transition-all"
                    >
                      Kết thúc & Bàn giao tiền
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShiftModal({ isOpen: true, type: 'start' })}
                      className="bg-black text-white px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg"
                    >
                      Bắt đầu ca mới
                    </button>
                  )}
                </div>
              </div>
              
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 p-8 text-stone-600/5 pointer-events-none">
                <ListChecks size={120} />
              </div>
            </div>

            <div className="bg-stone-100/50 p-8 rounded-[40px] flex flex-col justify-center border border-stone-100">
               <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 mb-6 flex items-center gap-2">
                 <Clock size={14} /> Thời gian hệ thống
               </h4>
               <p className="font-serif text-4xl text-stone-800">
                 {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
               </p>
               <p className="text-[10px] text-stone-400 mt-2">
                 {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
               </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[40px] border border-stone-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-stone-50 flex justify-between items-center bg-stone-50/30">
            <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500">Lịch sử hoạt động gần đây</h4>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Nhân viên</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400">Thời gian ca</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Tiền quầy</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Doanh thu COD</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Thực nhận</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(shifts) && shifts.map((s) => (
                <tr 
                  key={s.id} 
                  className={`border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors ${
                    s.status === 'closed' && s.difference !== 0 ? 'bg-red-50/30' : ''
                  }`}
                >
                  <td className="p-6">
                    <span className="font-bold text-sm block">{s.staffName}</span>
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${s.status === 'open' ? 'text-green-500' : 'text-stone-400'}`}>
                      {s.status === 'open' ? '• Đang làm' : 'Đã kết thúc'}
                    </span>
                  </td>
                  <td className="p-6 text-[10px] text-stone-500">
                    <div className="flex items-center gap-1">
                      {new Date(s.startTime).toLocaleTimeString()} {new Date(s.startTime).toLocaleDateString()}
                    </div>
                    {s.endTime && (
                      <div className="flex items-center gap-1 mt-1 font-medium text-stone-800">
                        <ChevronRight size={8} /> {new Date(s.endTime).toLocaleTimeString()}
                      </div>
                    )}
                  </td>
                  <td className="p-6 text-sm text-right">{(s.startCash || 0).toLocaleString()}đ</td>
                  <td className="p-6 text-sm font-medium text-right">{(s.totalOrderCash || 0).toLocaleString()}đ</td>
                  <td className="p-6 text-sm font-bold text-blue-600 text-right">{(s.actualCashReceived || 0).toLocaleString()}đ</td>
                  <td className="p-6 text-right">
                    <span className={`text-sm font-bold ${s.difference !== 0 && s.status === 'closed' ? 'text-red-600' : 'text-stone-400'}`}>
                      {s.difference > 0 ? '+' : ''}{(s.difference || 0).toLocaleString()}đ
                    </span>
                    {s.status === 'closed' && s.difference !== 0 && s.notes && (
                      <p className="text-[10px] text-stone-500 mt-1 italic max-w-[150px] ml-auto">Lý do: {s.notes}</p>
                    )}
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-4 text-stone-300">
                      <ListChecks size={48} />
                      <p className="italic text-sm">Chưa có dữ liệu ca làm việc</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderUsers = (role: 'customer' | 'staff') => {
    const filteredUsers = (Array.isArray(users) ? users : []).filter(u => 
      u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.phone && u.phone.includes(userSearch))
    );

    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-6">
            <h3 className="font-serif text-2xl">
              {role === 'customer' ? 'Quản lý khách hàng' : 'Quản lý nhân sự & Phân quyền'}
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const formatted = filteredUsers.map(u => ({
                    'Tên người dùng': u.name,
                    'Email': u.email,
                    'SĐT': u.phone || '',
                    'Địa chỉ': u.address || '',
                    'Vai trò': u.role,
                    'VIP': u.isVIP ? 'Có' : 'Không',
                    'Tổng chi tiêu': u.totalSpent || 0,
                    'Ghi chú': u.notes || ''
                  }));
                  exportDataToExcel(formatted, role === 'customer' ? 'DanhSachKhachHang' : 'DanhSachNhanSu');
                }}
                className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                Xuất Excel
              </button>
              {role === 'customer' && (
                <>
                  <button 
                    onClick={() => {
                      setImportingType('customers');
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-800 px-4 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                  >
                    Nhập Excel
                  </button>
                  <button 
                    onClick={() => {
                      setEditingCustomer(null);
                      setCustomerForm({ name: '', email: '', phone: '', address: '', notes: '', isVIP: false });
                      setIsCustomerModalOpen(true);
                    }}
                    className="bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Plus size={14} /> Thêm khách hàng
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input 
              type="text"
              placeholder="Tìm tên, email, sđt..."
              className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border border-stone-100 text-sm focus:ring-2 focus:ring-black outline-none"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
          </div>
        </div>

        {role === 'staff' && (
          <div className="bg-white p-10 rounded-[40px] border border-stone-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center">
                <UserPlus size={20} />
              </div>
              <h4 className="font-serif text-xl">Đăng ký tài khoản nhân sự mới</h4>
            </div>
            
            <form onSubmit={handleCreateStaff} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Họ tên</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Nguyễn Văn A"
                    className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                    value={staffForm.name}
                    onChange={e => setStaffForm({...staffForm, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Email</label>
                  <input 
                    type="email" 
                    required
                    placeholder="staff@example.com"
                    className={`w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm ${userFormErrors.email ? 'ring-2 ring-red-500' : ''}`}
                    value={staffForm.email}
                    onChange={e => setStaffForm({...staffForm, email: e.target.value})}
                  />
                  {userFormErrors.email && <p className="text-[10px] text-red-500 mt-1">{userFormErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Mật khẩu</label>
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••"
                    className={`w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm ${userFormErrors.password ? 'ring-2 ring-red-500' : ''}`}
                    value={staffForm.password}
                    onChange={e => setStaffForm({...staffForm, password: e.target.value})}
                  />
                  {userFormErrors.password && <p className="text-[10px] text-red-500 mt-1">{userFormErrors.password}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Vai trò</label>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                      value={staffForm.role}
                      onChange={e => setStaffForm({...staffForm, role: e.target.value as any})}
                    >
                      <option value="staff">Nhân viên (Staff)</option>
                      <option value="shipper">Giao hàng (Shipper)</option>
                      <option value="admin">Quản trị (Admin)</option>
                    </select>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="bg-black text-white px-8 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {loading ? '...' : 'Tạo'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400">Danh sách hiện tại</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((u) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-[32px] border border-stone-100 shadow-sm flex items-start gap-4 group hover:shadow-md transition-all h-full"
              >
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 relative">
                  <Users size={24} />
                  <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${u.status === 'inactive' ? 'bg-stone-300' : 'bg-green-500'}`} title={u.status === 'inactive' ? 'Inactive' : 'Active'} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm truncate">{u.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                      u.role === 'admin' ? 'bg-purple-50 text-purple-600' :
                      u.role === 'staff' ? 'bg-blue-50 text-blue-600' :
                      u.role === 'shipper' ? 'bg-amber-50 text-amber-600' :
                      'bg-stone-50 text-stone-600'
                    }`}>
                      {u.role === 'customer' ? 'Khách hàng' : u.role}
                    </span>
                    {u.isVIP && (
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200">
                        VIP
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-400 truncate flex items-center gap-1">
                      <ExternalLink size={10} /> {u.email}
                    </p>
                    {u.phone && (
                      <p className="text-[10px] text-stone-800 font-medium flex items-center gap-1">
                        <Truck size={10} className="text-stone-400" /> {u.phone}
                      </p>
                    )}
                    {u.role === 'customer' && (
                      <div className="mt-3 pt-3 border-t border-stone-50 flex justify-between items-center">
                        <span className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Tổng chi tiêu</span>
                        <span className="text-sm font-bold text-green-600">{(u.totalSpent || 0).toLocaleString()}đ</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      if (u.role === 'customer') {
                        setEditingCustomer(u);
                        setCustomerForm({
                          name: u.name,
                          email: u.email,
                          phone: u.phone || '',
                          address: u.address || '',
                          notes: u.notes || '',
                          isVIP: u.isVIP || false
                        });
                        setIsCustomerModalOpen(true);
                      } else {
                        setEditingUser({ ...u });
                        setIsEditUserModalOpen(true);
                      }
                    }}
                    className="p-2 text-stone-400 hover:text-black hover:bg-stone-50 rounded-xl transition-all"
                    title="Chỉnh sửa"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={() => handleResetPassword(u.id)}
                    className="p-2 text-stone-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                    title="Đặt lại mật khẩu"
                  >
                    <Key size={16} />
                  </button>
                  <button 
                    onClick={() => u.role === 'customer' ? handleDeleteCustomer(u.id) : handleDeleteUser(u.id)}
                    className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Xóa"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="col-span-full py-12 text-center text-stone-300 italic text-sm">
                Không tìm thấy kết quả phù hợp
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50/50 pb-20">
      <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx, .xls, .csv" className="hidden" />
      {/* Sidebar/Nav */}
      <div className="bg-white border-b border-stone-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h2 className="font-serif text-2xl italic">Midnight Admin</h2>
            <nav className="hidden md:flex items-center gap-1">
              {[
                { id: 'stats', label: 'Thống kê', icon: BarChart3, permission: 'view_revenue' },
                { id: 'products', label: 'Sản phẩm', icon: Package, permission: 'manage_inventory' },
                { id: 'inventory', label: 'Kho hàng', icon: Warehouse, permission: 'manage_inventory' },
                { id: 'suppliers', label: 'Nhà cung cấp', icon: Factory, permission: 'manage_inventory' },
                { id: 'shifts', label: 'Đối soát ca', icon: ListChecks, permission: null },
                { id: 'orders', label: 'Đơn hàng', icon: ShoppingBag, permission: 'approve_orders' },
                { id: 'customers', label: 'Khách hàng', icon: Users, permission: 'manage_hr' },
                { id: 'staff', label: 'Nhân sự', icon: UserPlus, permission: 'manage_hr' },
                { id: 'settings', label: 'Cài đặt', icon: SettingsIcon, adminOnly: true },
              ].filter(tab => {
                if (isAdmin) return true;
                if (tab.adminOnly) return false;
                if (tab.permission) {
                  return user?.permissions?.includes(tab.permission);
                }
                return true;
              }).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                    activeTab === tab.id ? 'bg-black text-white' : 'text-stone-400 hover:text-black hover:bg-stone-50'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest">{user?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold">
              {user?.name?.[0]}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pt-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {loading && activeTab !== 'products' ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-stone-200 border-t-black rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {activeTab === 'stats' && renderStats()}
                {activeTab === 'products' && renderProducts()}
                {activeTab === 'orders' && renderOrders()}
                {activeTab === 'customers' && renderUsers('customer')}
                {activeTab === 'staff' && renderUsers('staff')}
                {activeTab === 'inventory' && renderInventory()}
                {activeTab === 'suppliers' && renderSuppliers()}
                {activeTab === 'shifts' && renderShifts()}
                {activeTab === 'settings' && renderSettings()}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Product Modal (Add/Edit) */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProductModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl"
            >
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="absolute top-8 right-8 p-2 hover:bg-stone-100 rounded-full transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="p-10 max-h-[90vh] overflow-y-auto">
                <div className="mb-8">
                  <h3 className="font-serif text-3xl">{editingProduct ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                  {editingProduct && editingProduct.createdBy && (
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                       <Plus size={10} /> Được tạo bởi <span className="text-black font-bold">{editingProduct.createdBy.name}</span>
                       {'createdAt' in editingProduct && editingProduct.createdAt && ` vào ngày ${new Date(editingProduct.createdAt).toLocaleDateString('vi-VN')}`}
                    </p>
                  )}
                </div>
                
                <form onSubmit={handleProductSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Tên sản phẩm</label>
                      <input 
                        type="text" 
                        required
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Danh mục</label>
                      <select 
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.category}
                        onChange={e => setForm({...form, category: e.target.value})}
                      >
                        <option value="Roses">Hoa Hồng (Roses)</option>
                        <option value="Tulips">Hoa Tulips</option>
                        <option value="Lilies">Hoa Ly (Lilies)</option>
                        <option value="Orchids">Hoa Lan (Orchids)</option>
                        <option value="Sunflowers">Hướng Dương</option>
                        <option value="Mixed">Bó Hoa Hỗn Hợp</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Giá gốc (VNĐ)</label>
                      <input 
                        type="number" 
                        required
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.originalPrice}
                        onChange={e => {
                          const val = e.target.value;
                          const oP = Number(val) || 0;
                          const disc = Number(form.discount) || 0;
                          setForm({...form, originalPrice: val, price: (oP * (1 - disc/100)).toString()});
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">% Giảm giá</label>
                      <input 
                        type="number"
                        min="0" max="100"
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.discount}
                        onChange={e => {
                          const val = e.target.value;
                          const disc = Number(val) || 0;
                          const oP = Number(form.originalPrice) || 0;
                          setForm({...form, discount: val, price: (oP * (1 - disc/100)).toString()});
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Giá nhập/Vốn (VNĐ)</label>
                      <input 
                        type="number" 
                        required
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.costPrice}
                        onChange={e => setForm({...form, costPrice: e.target.value})}
                      />
                      {Number(form.price) < Number(form.costPrice) * 1.2 && Number(form.price) > 0 && Number(form.costPrice) > 0 && (
                        <p className="text-[10px] text-amber-500 font-bold mt-1 animate-pulse">⚠️ Giá bán quá thấp, lợi nhuận không đảm bảo (Biên lợi nhuận &lt; 20%)</p>
                      )}
                    </div>

                    <div className="md:col-span-2 flex items-center gap-6">
                       <div className="flex items-center gap-2">
                         <input 
                           type="checkbox" 
                           id="isStackable"
                           checked={form.isStackable}
                           onChange={e => setForm({...form, isStackable: e.target.checked})}
                           className="rounded text-black focus:ring-black w-4 h-4 cursor-pointer"
                         />
                         <label htmlFor="isStackable" className="text-sm font-medium text-stone-700 cursor-pointer">
                           Cho phép cộng dồn với ưu đãi VIP
                         </label>
                       </div>
                       
                       <div className="flex items-center gap-2">
                         <input 
                           type="checkbox" 
                           id="isHidden"
                           checked={form.isHidden}
                           onChange={e => setForm({...form, isHidden: e.target.checked})}
                           className="rounded text-black focus:ring-black w-4 h-4 cursor-pointer"
                         />
                         <label htmlFor="isHidden" className="text-sm font-medium text-stone-700 cursor-pointer">
                           Tạm ẩn sản phẩm khỏi cửa hàng
                         </label>
                       </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Giá bán (VNĐ)</label>
                      <input 
                        type="number" 
                        required
                        readOnly
                        className="w-full p-4 bg-stone-100/50 rounded-2xl border-none text-sm text-stone-500 font-medium"
                        value={form.price}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Dịp lễ</label>
                      <div className="flex flex-wrap gap-2">
                        {['Sinh nhật', 'Khai trương', 'Tình yêu', 'Xin lỗi'].map(occ => (
                          <button
                            key={occ}
                            type="button"
                            onClick={() => {
                              const newOccasions = form.occasions.includes(occ)
                                ? form.occasions.filter(o => o !== occ)
                                : [...form.occasions, occ];
                              setForm({...form, occasions: newOccasions});
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                              form.occasions.includes(occ) ? 'bg-black text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                          >
                            {occ}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Màu sắc</label>
                      <select 
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.color}
                        onChange={e => setForm({...form, color: e.target.value})}
                      >
                        <option value="">Chọn màu sắc</option>
                        <option value="Đỏ">Đỏ</option>
                        <option value="Trắng">Trắng</option>
                        <option value="Hồng">Hồng</option>
                        <option value="Vàng">Vàng</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Số lượng tồn kho</label>
                      <input 
                        type="number" 
                        required
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.stock}
                        onChange={e => setForm({...form, stock: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Ngưỡng báo động</label>
                      <input 
                        type="number" 
                        required
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.minStock}
                        onChange={e => setForm({...form, minStock: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Đơn vị tính</label>
                      <input 
                        type="text" 
                        required
                        placeholder="bó, cành, cái..."
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={form.unit}
                        onChange={e => setForm({...form, unit: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Hình ảnh sản phẩm</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="border-2 border-dashed border-stone-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-2 group-hover:border-black transition-all bg-stone-50">
                          {uploading ? (
                            <div className="w-6 h-6 border-2 border-stone-200 border-t-black rounded-full animate-spin" />
                          ) : (
                            <>
                              <Upload size={24} className="text-stone-400 group-hover:text-black transition-all" />
                              <span className="text-xs text-stone-400 font-medium">Tải ảnh lên</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          placeholder="Hoặc dán URL ảnh tại đây..."
                          className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                          value={form.image}
                          onChange={e => setForm({...form, image: e.target.value})}
                        />
                        <p className="text-[10px] text-stone-400 italic">Mẹo: Nếu tải ảnh lên lỗi, hãy dán URL ảnh trực tiếp vào đây.</p>
                      </div>
                    </div>
                    {form.image && (
                      <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-stone-100">
                        <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setForm({...form, image: ''})}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit"
                    disabled={loading || uploading}
                    className="w-full bg-black text-white py-5 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Đang xử lý...' : editingProduct ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Shift Modals */}
      <AnimatePresence>
        {shiftModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[40px] p-10 overflow-hidden shadow-2xl relative"
            >
              <button 
                onClick={() => setShiftModal({ ...shiftModal, isOpen: false })}
                className="absolute top-8 right-8 p-2 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <h3 className="font-serif text-2xl mb-2">
                {shiftModal.type === 'start' ? 'Bắt đầu ca làm việc' : 'Kết thúc ca & Bàn giao'}
              </h3>
              <p className="text-stone-400 text-[10px] uppercase tracking-widest mb-8">
                {shiftModal.type === 'start' ? 'Nhập số tiền mặt có sẵn trong quầy' : 'Đối soát số dư thực tế'}
              </p>

              <form onSubmit={shiftModal.type === 'start' ? handleStartShift : handleEndShift} className="space-y-6">
                {shiftModal.type === 'start' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Tiền quầy bắt đầu (VNĐ)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="0"
                      className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                      value={shiftActionForm.startCash}
                      onChange={e => setShiftActionForm({...shiftActionForm, startCash: e.target.value})}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Tiền mặt thực nhận (VNĐ)</label>
                      <input 
                        type="number" 
                        required
                        placeholder="Số tiền bạn đang cầm..."
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm font-bold"
                        value={shiftActionForm.actualCashReceived}
                        onChange={e => setShiftActionForm({...shiftActionForm, actualCashReceived: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Ghi chú đối soát</label>
                      <textarea 
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={shiftActionForm.notes}
                        onChange={e => setShiftActionForm({...shiftActionForm, notes: e.target.value})}
                        rows={3}
                        placeholder="Lý do chênh lệch (nếu có)..."
                      />
                    </div>
                  </>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                    shiftModal.type === 'start' ? 'bg-black text-white hover:bg-stone-800' : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {loading ? 'Đang xử lý...' : shiftModal.type === 'start' ? 'Xác nhận Bắt đầu' : 'Xác nhận Bàn giao & Đóng ca'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {isEditUserModalOpen && editingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-stone-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif text-3xl">Chỉnh sửa Quyền hạn</h3>
                  <button onClick={() => setIsEditUserModalOpen(false)} className="text-stone-400 hover:text-black">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-sm text-stone-400 mb-8">
                  Cập nhật vai trò, thông tin và các quyền truy cập chi tiết cho <span className="font-bold text-stone-800">{editingUser.name}</span>
                </p>

                <form onSubmit={handleUpdateUser} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Họ và tên</label>
                      <input 
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={editingUser.name}
                        onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Số điện thoại</label>
                      <input 
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={editingUser.phone || ''}
                        onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Email đăng nhập</label>
                      <input 
                        type="email"
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={editingUser.email}
                        onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Trạng thái</label>
                      <select 
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={editingUser.status}
                        onChange={e => setEditingUser({ ...editingUser, status: e.target.value })}
                      >
                        <option value="active">Đang hoạt động</option>
                        <option value="inactive">Tạm khóa</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Vai trò</label>
                      <select 
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={editingUser.role}
                        onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                      >
                        <option value="staff">Nhân viên (Staff)</option>
                        <option value="shipper">Giao hàng (Shipper)</option>
                        <option value="admin">Quản trị (Admin)</option>
                      </select>
                    </div>
                  </div>

                  {editingUser.role === 'staff' && (
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Quyền truy cập chi tiết</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {AVAILABLE_PERMISSIONS.map(p => (
                          <label key={p.id} className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl cursor-pointer hover:bg-stone-100 transition-colors">
                            <input 
                              type="checkbox"
                              className="w-4 h-4 rounded-md border-stone-200 text-black focus:ring-black"
                              checked={(editingUser.permissions || []).includes(p.id)}
                              onChange={(e) => {
                                const perms = [...(editingUser.permissions || [])];
                                if (e.target.checked) {
                                  perms.push(p.id);
                                } else {
                                  const idx = perms.indexOf(p.id);
                                  if (idx > -1) perms.splice(idx, 1);
                                }
                                setEditingUser({ ...editingUser, permissions: perms });
                              }}
                            />
                            <span className="text-sm font-medium text-stone-700">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsEditUserModalOpen(false)}
                      className="flex-1 py-5 rounded-full text-xs font-bold uppercase tracking-widest border border-stone-100 hover:bg-stone-50 transition-all"
                    >
                      Hủy
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-black text-white py-5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50"
                    >
                      {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Modal */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-stone-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif text-3xl">{editingCustomer ? 'Sửa thông tin khách' : 'Thêm khách hàng mới'}</h3>
                  <button onClick={() => setIsCustomerModalOpen(false)} className="text-stone-400 hover:text-black">
                    <X size={24} />
                  </button>
                </div>
                
                <form onSubmit={handleCustomerSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Họ tên</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Nguyễn Văn A"
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={customerForm.name}
                        onChange={e => setCustomerForm({...customerForm, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Số điện thoại</label>
                      <input 
                        type="tel" 
                        required
                        placeholder="0912xxx..."
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={customerForm.phone}
                        onChange={e => setCustomerForm({...customerForm, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Email</label>
                    <input 
                      type="email" 
                      required
                      placeholder="email@example.com"
                      className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                      value={customerForm.email}
                      onChange={e => setCustomerForm({...customerForm, email: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Địa chỉ</label>
                    <input 
                      type="text" 
                      placeholder="Số nhà, đường, phường, quận..."
                      className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                      value={customerForm.address}
                      onChange={e => setCustomerForm({...customerForm, address: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Ghi chú khách hàng</label>
                    <textarea 
                      rows={3}
                      placeholder="VD: Thích hoa hồng, hay đặt hàng Tết..."
                      className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                      value={customerForm.notes}
                      onChange={e => setCustomerForm({...customerForm, notes: e.target.value})}
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-3 p-4 bg-amber-50/50 rounded-2xl cursor-pointer hover:bg-amber-50 transition-colors border border-amber-100">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded-md border-amber-300 text-amber-500 focus:ring-amber-500"
                        checked={customerForm.isVIP}
                        onChange={(e) => setCustomerForm({...customerForm, isVIP: e.target.checked})}
                      />
                      <div>
                        <p className="text-sm font-bold text-amber-900">Thẻ VIP Khách hàng</p>
                        <p className="text-xs text-amber-700/70 mt-0.5">Khách hàng được giảm giá 20% khi đặt hàng</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsCustomerModalOpen(false)}
                      className="flex-1 py-5 rounded-full text-xs font-bold uppercase tracking-widest border border-stone-100 hover:bg-stone-50 transition-all"
                    >
                      Hủy
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-black text-white py-5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 shadow-lg"
                    >
                      {loading ? 'Đang lưu...' : editingCustomer ? 'Cập nhật' : 'Lưu khách hàng'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Order Detail Modal */}
      <AnimatePresence>
        {isOrderDetailOpen && selectedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <div>
                  <h3 className="font-serif text-3xl">Chi tiết đơn hàng</h3>
                  <p className="text-stone-400 text-xs uppercase tracking-widest mt-1">Mã đơn: #{selectedOrder.id.toUpperCase()}</p>
                </div>
                <button onClick={() => setIsOrderDetailOpen(false)} className="text-stone-400 hover:text-black p-2 bg-white rounded-full shadow-sm hover:rotate-90 transition-all duration-300">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-10 max-h-[70vh] overflow-y-auto space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Thông tin khách hàng / Giao hàng</h4>
                    <div className="bg-stone-50 p-6 rounded-3xl space-y-2">
                      <p className="text-sm font-bold">{selectedOrder.address.street}</p>
                      <p className="text-xs text-stone-500">{selectedOrder.address.ward}, {selectedOrder.address.district}</p>
                      <div className="pt-2 flex gap-2">
                         <span className="px-2 py-0.5 bg-stone-200 rounded text-[8px] font-bold uppercase tracking-widest text-stone-600">Ngày giao: {selectedOrder.deliveryDate}</span>
                         <span className="px-2 py-0.5 bg-stone-200 rounded text-[8px] font-bold uppercase tracking-widest text-stone-600">{selectedOrder.deliveryTime}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Thanh toán</h4>
                    <div className="bg-stone-50 p-6 rounded-3xl flex flex-col justify-between h-[120px]">
                      <div>
                        <p className="text-sm font-bold">{selectedOrder.paymentMethod === 'COD' ? 'Tiền mặt' : selectedOrder.paymentMethod === 'Bank' ? 'Chuyển khoản' : 'Ví MoMo'}</p>
                        <p className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${selectedOrder.isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                          {selectedOrder.isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </p>
                      </div>
                      <p className="text-xl font-serif">{selectedOrder.totalAmount.toLocaleString('vi-VN')}đ</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Nội dung thiệp / Lời nhắn</h4>
                  <div className="bg-stone-50 p-8 rounded-3xl border-l-4 border-black italic text-stone-600 leading-relaxed">
                    "{selectedOrder.cardMessage || 'Không có lời nhắn'}"
                  </div>
                </div>

                {selectedOrder.returnStatus !== 'None' && (
                  <div className="space-y-4 pt-4 border-t border-stone-100">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-amber-500">Yêu cầu trả hàng/hoàn tiền</h4>
                    <div className="bg-amber-50 p-6 rounded-3xl space-y-4 border border-amber-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-bold text-amber-900">Lý do:</p>
                          <p className="text-sm text-amber-800 mt-1">{selectedOrder.returnReason}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          selectedOrder.returnStatus === 'Requested' ? 'bg-amber-200 text-amber-800' :
                          selectedOrder.returnStatus === 'Approved' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                        }`}>
                          {selectedOrder.returnStatus === 'Requested' ? 'Chờ duyệt' :
                           selectedOrder.returnStatus === 'Approved' ? 'Đã chấp nhận' : 'Đã từ chối'}
                        </span>
                      </div>
                      
                      {selectedOrder.returnImages && selectedOrder.returnImages.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-amber-900">Hình ảnh minh chứng:</p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {selectedOrder.returnImages.map((img, idx) => (
                              <img key={idx} src={img} className="w-20 h-20 rounded-xl object-cover border border-amber-200" alt="Proof" />
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedOrder.returnStatus === 'Requested' && (
                        <button 
                          onClick={() => {
                            setReturnHandleForm({
                              status: 'Approved',
                              refundAmount: selectedOrder.totalAmount,
                              restock: true
                            });
                            setIsReturnHandleOpen(true);
                          }}
                          className="w-full py-3 bg-amber-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                        >
                          Phản hồi yêu cầu trả hàng
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Sản phẩm ({selectedOrder.items.length})</h4>
                  <div className="space-y-4">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-4 bg-stone-50 p-4 rounded-2xl">
                        <img src={item.image} className="w-12 h-12 rounded-xl object-cover" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-[10px] text-stone-400 font-bold tracking-widest uppercase">{item.quantity} x {item.price.toLocaleString('vi-VN')}đ</p>
                        </div>
                        <p className="text-sm font-bold">{(item.quantity * item.price).toLocaleString('vi-VN')}đ</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.editHistory && selectedOrder.editHistory.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-stone-100">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Lịch sử chỉnh thử thông tin</h4>
                    <div className="space-y-4">
                      {selectedOrder.editHistory.map((edit, idx) => (
                        <div key={idx} className="bg-stone-50 p-4 rounded-2xl flex items-start gap-4">
                          <div className="p-2 bg-white rounded-xl shadow-sm">
                            <Edit3 size={14} className="text-stone-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-stone-900">{edit.field}</p>
                              <p className="text-[10px] text-stone-400">
                                {new Date(edit.timestamp).toLocaleString('vi-VN')}
                              </p>
                            </div>
                            <p className="text-[10px] text-stone-500">Bởi <span className="text-black">{edit.staffName}</span></p>
                            <div className="mt-2 text-[10px] flex items-center gap-2">
                              <span className="text-stone-400 line-through truncate max-w-[100px]">{edit.oldValue}</span>
                              <ChevronRight size={10} className="text-stone-300" />
                              <span className="text-stone-700 font-medium truncate max-w-[150px]">{edit.newValue}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-6 pt-4">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Lịch sử thao tác</h4>
                  <div className="relative pl-6 space-y-8 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-100">
                    {selectedOrder.actionHistory && selectedOrder.actionHistory.length > 0 ? (
                      [...selectedOrder.actionHistory].reverse().map((log, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                            log.action === 'Xác nhận đơn hàng' ? 'bg-purple-500' : 
                            log.action === 'Cập nhật trạng thái' ? 'bg-blue-500' : 'bg-stone-400'
                          }`} />
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-stone-900">{log.action}</p>
                              <p className="text-[10px] text-stone-400 font-medium">
                                {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                {' '}
                                {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                              </p>
                            </div>
                            <p className="text-[10px] text-stone-500">
                              Bởi <span className="text-black font-bold">{log.staffName}</span>
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-stone-100 rounded text-[9px] text-stone-500 line-through">{log.oldValue}</span>
                              <ChevronRight size={10} className="text-stone-300" />
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                                log.newValue === 'delivered' ? 'bg-green-100 text-green-700' :
                                log.newValue === 'shipping' ? 'bg-blue-100 text-blue-700' :
                                log.newValue === 'confirmed' ? 'bg-purple-100 text-purple-700' :
                                'bg-stone-100 text-stone-700'
                              }`}>
                                {log.newValue === 'delivered' ? 'Hoàn thành' :
                                 log.newValue === 'shipping' ? 'Đang giao' :
                                 log.newValue === 'confirmed' ? 'Đã duyệt' :
                                 log.newValue === 'processing' ? 'Đang cắm hoa' :
                                 log.newValue === 'ready' ? 'Sẵn sàng' : log.newValue}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-stone-300 italic text-xs">Chưa có lịch sử thao tác</div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-stone-100">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-green-600">Lịch sử xử lý (Thời gian thực)</h4>
                  <div className="space-y-4">
                    {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 ? (
                      [...selectedOrder.statusHistory].reverse().map((log, i) => (
                        <div key={i} className="flex items-start gap-4 text-xs">
                          <div className="min-w-[120px] text-stone-400 font-mono">
                            [{new Date(log.updatedAt).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})} {new Date(log.updatedAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}]
                          </div>
                          <div className="flex-1">
                            <span className="font-bold text-stone-900">{log.updatedBy.name}</span>
                            <span className="text-stone-500"> đã chuyển trạng thái sang </span>
                            <span className="font-bold text-black uppercase">{
                              log.status === 'pending' ? 'Chờ duyệt' :
                              log.status === 'confirmed' ? 'Đã duyệt' :
                              log.status === 'processing' ? 'Đang chuẩn bị' :
                              log.status === 'ready' ? 'Sẵn sàng' :
                              log.status === 'shipping' ? 'Đang giao' :
                              log.status === 'delivered' ? 'Hoàn thành' :
                              log.status === 'failed' ? 'Thất bại' :
                              log.status === 'refunded' ? 'Hoàn tiền' :
                              log.status === 'returned' ? 'Trả hàng' :
                              log.status === 'cancelled' ? 'Đã hủy' : log.status
                            }</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-2 text-stone-300 italic text-[10px]">Chưa có dữ liệu thời gian thực</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-10 border-t border-stone-100 flex gap-4">
                <button 
                  onClick={() => setIsOrderDetailOpen(false)}
                  className="flex-1 py-4 rounded-full text-xs font-bold uppercase tracking-widest border border-stone-200 hover:bg-stone-50 transition-all font-sans"
                >
                  Đóng
                </button>
                <div className="flex-1">
                  <select 
                    value={selectedOrder.status}
                    onChange={(e) => handleUpdateOrderStatus(selectedOrder.id, e.target.value)}
                    className={`w-full py-4 px-6 rounded-full text-xs font-bold uppercase tracking-widest border-none focus:ring-0 cursor-pointer shadow-lg text-center ${
                      selectedOrder.status === 'delivered' ? 'bg-green-600 text-white' :
                      selectedOrder.status === 'shipping' ? 'bg-blue-600 text-white' :
                      'bg-black text-white'
                    }`}
                  >
                    <option value="pending">Chờ duyệt</option>
                    <option value="confirmed">Đã duyệt</option>
                    <option value="processing">Đang thực hiện</option>
                    <option value="ready">Sẵn sàng</option>
                    <option value="shipping">Đang giao</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="returned">Trả hàng</option>
                    <option value="cancelled">Đã hủy</option>
                    <option value="failed">Thất bại</option>
                  </select>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Price History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedProductHistory && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center">
                    <History size={24} />
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl">Lịch sử thay đổi giá</h3>
                    <p className="text-stone-400 text-[10px] uppercase tracking-widest mt-1">Sản phẩm: {selectedProductHistory.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)} 
                  className="text-stone-400 hover:text-black p-2 bg-white rounded-full shadow-sm hover:rotate-90 transition-all duration-300"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-10 max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="pb-4 text-[10px] uppercase tracking-widest font-bold text-stone-400">Thời gian</th>
                      <th className="pb-4 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Giá cũ</th>
                      <th className="pb-4 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Giá mới</th>
                      <th className="pb-4 text-[10px] uppercase tracking-widest font-bold text-stone-400 text-right">Người sửa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {selectedProductHistory.priceHistory && selectedProductHistory.priceHistory.length > 0 ? (
                      [...selectedProductHistory.priceHistory].reverse().map((h, i) => (
                        <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-4 text-xs text-stone-500">
                            {new Date(h.updatedAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-4 text-xs font-medium text-stone-400 text-right">
                            {h.oldPrice.toLocaleString()}đ
                          </td>
                          <td className="py-4 text-sm font-bold text-black text-right">
                            {h.newPrice.toLocaleString()}đ
                          </td>
                          <td className="py-4 text-xs font-bold text-stone-900 text-right">
                            {h.updatedBy?.name || '---'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-stone-300 italic text-sm">
                          Chưa có lịch sử thay đổi giá
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-10 border-t border-stone-100 bg-stone-50/30">
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-full py-4 rounded-full bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                >
                  Đóng nội dung
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Order Modal */}
      <AnimatePresence>
        {isEditOrderOpen && selectedOrder && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <h3 className="font-serif text-2xl">Sửa thông tin đơn hàng</h3>
                <button onClick={() => setIsEditOrderOpen(false)} className="text-stone-400 hover:text-black">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleEditOrderSubmit} className="p-10 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-stone-400">Phường/Xã</label>
                    <input 
                      type="text" 
                      value={editForm.ward} 
                      onChange={(e) => setEditForm({...editForm, ward: e.target.value})}
                      className="w-full bg-stone-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-stone-400">Quận/Huyện</label>
                    <input 
                      type="text" 
                      value={editForm.district} 
                      onChange={(e) => setEditForm({...editForm, district: e.target.value})}
                      className="w-full bg-stone-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">Số nhà, tên đường</label>
                  <input 
                    type="text" 
                    value={editForm.street} 
                    onChange={(e) => setEditForm({...editForm, street: e.target.value})}
                    className="w-full bg-stone-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">Lời nhắn trên thiệp</label>
                  <textarea 
                    value={editForm.cardMessage} 
                    onChange={(e) => setEditForm({...editForm, cardMessage: e.target.value})}
                    rows={4}
                    className="w-full bg-stone-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-black resize-none"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditOrderOpen(false)}
                    className="flex-1 py-4 rounded-full border border-stone-200 text-xs font-bold uppercase tracking-widest"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 rounded-full bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Handle Modal */}
      <AnimatePresence>
        {isReturnHandleOpen && selectedOrder && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-10 border-b border-stone-100 flex justify-between items-center bg-amber-50">
                <h3 className="font-serif text-2xl text-amber-900">Phản hồi trả hàng</h3>
                <button onClick={() => setIsReturnHandleOpen(false)} className="text-amber-400 hover:text-amber-900">
                  <X size={24} />
                </button>
              </div>
              <div className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-stone-400">Quyết định</label>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setReturnHandleForm({...returnHandleForm, status: 'Approved'})}
                      className={`flex-1 py-3 rounded-xl border-2 transition-all text-xs font-bold ${
                        returnHandleForm.status === 'Approved' ? 'border-green-600 bg-green-50 text-green-700' : 'border-stone-100 text-stone-400'
                      }`}
                    >
                      Chấp nhận
                    </button>
                    <button 
                      onClick={() => setReturnHandleForm({...returnHandleForm, status: 'Rejected'})}
                      className={`flex-1 py-3 rounded-xl border-2 transition-all text-xs font-bold ${
                        returnHandleForm.status === 'Rejected' ? 'border-red-600 bg-red-50 text-red-700' : 'border-stone-100 text-stone-400'
                      }`}
                    >
                      Từ chối
                    </button>
                  </div>
                </div>

                {returnHandleForm.status === 'Approved' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-stone-400">Số tiền hoàn (VNĐ)</label>
                      <input 
                        type="number" 
                        value={returnHandleForm.refundAmount} 
                        onChange={(e) => setReturnHandleForm({...returnHandleForm, refundAmount: Number(e.target.value)})}
                        className="w-full bg-stone-50 p-4 rounded-2xl border-none focus:ring-2 focus:ring-green-600"
                      />
                    </div>
                    <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={returnHandleForm.restock} 
                        onChange={(e) => setReturnHandleForm({...returnHandleForm, restock: e.target.checked})}
                        className="w-5 h-5 rounded border-stone-300 text-black focus:ring-black"
                      />
                      <span className="text-sm font-medium">Nhập lại kho (Hoa tái sử dụng)</span>
                    </label>
                  </>
                )}

                <button 
                  onClick={handleReturnAction}
                  className="w-full py-4 rounded-full bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all font-sans mt-4"
                >
                  Xác nhận phản hồi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={globalConfirm.isOpen}
        onClose={() => setGlobalConfirm({ ...globalConfirm, isOpen: false })}
        onConfirm={() => {
          globalConfirm.onConfirm();
          setGlobalConfirm({ ...globalConfirm, isOpen: false });
        }}
        title={globalConfirm.title}
        message={globalConfirm.message}
        type={globalConfirm.type}
      />
     </div>
  );
}
