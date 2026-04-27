import { useState, useEffect } from 'react';
import api from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, MapPin, CheckCircle, Truck, User, AlertCircle, X } from 'lucide-react';
import { Order } from '../types';
import toast from 'react-hot-toast';
import OrderStepper from './OrderStepper';
import ConfirmModal from './ConfirmModal';

export default function ShipperDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [globalConfirm, setGlobalConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info' as 'info' | 'warning' | 'danger'
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders/shipper');
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, status: string, reason?: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status, reason });
      toast.success(status === 'failed' ? 'Đã báo cáo lỗi giao hàng' : 'Cập nhật trạng thái thành công');
      setIsErrorModalOpen(false);
      fetchOrders();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi cập nhật trạng thái');
      fetchOrders();
    }
  };

  const openErrorModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsErrorModalOpen(true);
  };

  if (loading) return <div className="p-8 text-center text-stone-400 uppercase tracking-widest text-xs">Đang tải danh sách đơn hàng...</div>;

  const currentOrders = orders.filter(o => ['ready', 'shipping'].includes(o.status));
  const historyOrders = orders.filter(o => !['ready', 'shipping'].includes(o.status));
  
  const displayOrders = activeTab === 'current' ? currentOrders : historyOrders;

  const handleUpdateStatusConfirm = (orderId: string, status: string, title: string, message: string) => {
    setGlobalConfirm({
      isOpen: true,
      title,
      message,
      type: 'info',
      onConfirm: () => updateStatus(orderId, status)
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-3xl">Đơn hàng giao</h3>
        <div className="flex bg-stone-100 p-1 rounded-full">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === 'current' ? 'bg-white text-black shadow-sm' : 'text-stone-500'
            }`}
          >
            Hiện tại ({currentOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === 'history' ? 'bg-white text-black shadow-sm' : 'text-stone-500'
            }`}
          >
            Lịch sử ({historyOrders.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {displayOrders.map((order) => (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[32px] border border-stone-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center text-stone-400">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Mã đơn hàng</p>
                    <p className="font-serif text-xl">#{order.id.slice(-6).toUpperCase()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 text-stone-600">
                    <MapPin size={18} className="mt-1 flex-shrink-0 text-stone-400" />
                    <p className="text-sm leading-relaxed">
                      {order.address.street}, {order.address.ward}, {order.address.district}
                    </p>
                  </div>
                  <div className="w-full">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-2">Tiến độ giao hàng</p>
                    <OrderStepper 
                      status={order.status} 
                      role="shipper" 
                      statusHistory={order.statusHistory}
                      reason={order.status === 'failed' || order.status === 'cancelled' ? order.failedReason : (order.status === 'returned' || order.status === 'refunded') ? order.returnReason : undefined}
                      onStatusUpdate={(newStatus) => updateStatus(order.id, newStatus)} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[200px]">
                <div className="bg-stone-50 p-4 rounded-2xl flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest text-stone-400">Tổng tiền</span>
                  <span className="font-bold">{order.totalAmount.toLocaleString('vi-VN')} đ</span>
                </div>
                
                {activeTab === 'current' && (
                  order.status === 'ready' ? (
                    <button
                      onClick={() => handleUpdateStatusConfirm(order.id, 'shipping', 'Nhận giao hàng', 'Bạn có chắc chắn muốn nhận giao đơn hàng này không?')}
                      className="w-full bg-black text-white py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all flex items-center justify-center gap-2 group"
                    >
                      <Truck size={16} className="group-hover:scale-110 transition-transform" />
                      Nhận đơn giao
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleUpdateStatusConfirm(order.id, 'completed', 'Giao hàng thành công', 'Xác nhận đơn hàng đã được giao đến tay khách hàng?')}
                        className="w-full bg-green-500 text-white py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-green-600 transition-all flex items-center justify-center gap-2 group"
                      >
                        <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
                        Giao hàng thành công
                      </button>
                      <button
                        onClick={() => openErrorModal(order.id)}
                        className="w-full bg-red-50 text-red-500 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                      >
                        <AlertCircle size={16} />
                        Báo lỗi giao hàng
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </motion.div>
        ))}

        <AnimatePresence>
          {isErrorModalOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsErrorModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl">
                <button onClick={() => setIsErrorModalOpen(false)} className="absolute top-8 right-8 text-stone-400 hover:text-black transition-colors"><X size={20} /></button>
                <h3 className="font-serif text-2xl mb-6">Lý do giao thất bại</h3>
                <div className="space-y-3">
                  {['Khách không nghe máy', 'Sai địa chỉ', 'Khách hẹn giao lại', 'Lý do khác'].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => updateStatus(selectedOrderId, 'failed', reason)}
                      className="w-full p-4 bg-stone-50 hover:bg-stone-100 rounded-2xl text-left text-sm font-medium transition-colors"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {displayOrders.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center min-h-[50vh] border-2 border-dashed border-stone-100 rounded-[40px]">
            <Truck size={48} className="mx-auto text-stone-200 mb-4" />
            <p className="text-stone-400 uppercase tracking-widest text-xs">Không có đơn hàng nào</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={globalConfirm.isOpen}
        onClose={() => setGlobalConfirm({ ...globalConfirm, isOpen: false })}
        onConfirm={globalConfirm.onConfirm}
        title={globalConfirm.title}
        message={globalConfirm.message}
        type={globalConfirm.type}
      />
    </div>
  );
}
