import { useState, useEffect } from 'react';
import api from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Loader2, Trash2, Plus, Minus, AlertTriangle } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

export default function CheckoutModal({ isOpen, onClose, onSuccess }: CheckoutModalProps) {
  const { cart, subtotal, shipping, total, clearCart, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [cardMessage, setCardMessage] = useState('');
  const [address, setAddress] = useState({ district: '', ward: '', street: '' });
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('08:00 - 10:00');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'Bank' | 'MoMo'>('COD');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedItemIds(cart.map(item => item.id));
      setStep('details');
      setQrUrl('');
      setCurrentOrder(null);
      setPendingOrderData(null);
      fetchPaymentSettings();
    }
  }, [isOpen, cart]);

  const fetchPaymentSettings = async () => {
    try {
      const res = await api.get('/settings/payment');
      setPaymentSettings(res.data);
    } catch (error) {
      console.error('Failed to fetch payment settings', error);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectedItems = cart.filter(item => selectedItemIds.includes(item.id));
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const selectedShipping = selectedItems.length > 0 ? (user?.isVIP ? 0 : 20000) : 0;
  const selectedTotal = selectedSubtotal + selectedShipping;
  const rawSubtotal = selectedItems.reduce((sum, item) => sum + ((user?.isVIP ? item.price / 0.8 : item.price) * item.quantity), 0);

  const timeSlots = [
    '08:00 - 10:00',
    '10:00 - 12:00',
    '13:00 - 15:00',
    '15:00 - 17:00',
    '17:00 - 19:00',
    '19:00 - 21:00'
  ];

  const handleCheckout = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để đặt hàng');
      return;
    }
    if (!address.district || !address.ward || !address.street) {
      toast.error('Vui lòng nhập đầy đủ địa chỉ giao hàng');
      return;
    }
    if (!deliveryDate) {
      toast.error('Vui lòng chọn ngày giao hàng');
      return;
    }
    if (!policyAccepted) {
      toast.error('Vui lòng xác nhận chính sách hủy đơn');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sản phẩm để thanh toán');
      return;
    }

    setIsConfirmOpen(true);
  };

  const processOrder = async () => {
    setLoading(true);
    try {
      const finalTotal = selectedTotal;
      const orderData = {
        items: selectedItems.map(i => ({ 
          product: i.id || (i as any)._id, 
          name: i.name,
          quantity: i.quantity, 
          price: i.price,
          image: i.image
        })),
        totalAmount: finalTotal,
        cardMessage,
        address,
        deliveryDate,
        deliveryTime,
        paymentMethod
      };

      if (paymentMethod === 'COD') {
        const response = await api.post('/orders', orderData);
        
        for (const id of selectedItemIds) {
          await removeFromCart(id);
        }
        
        onSuccess(response.data.order);
        onClose();
        toast.success('Đặt hàng thành công! Vui lòng thanh toán tiền mặt khi nhận hoa.');
      } else {
        // Save pending data and show QR, but don't call API yet
        const tempRef = `LART-${Date.now().toString().slice(-6)}`;
        const bankId = paymentSettings?.bankName?.split(' ')[0] || 'MB';
        const accountNumber = paymentSettings?.accountNumber || '0348270597';
        const accountName = encodeURIComponent(paymentSettings?.accountHolder || 'NGUYEN HUU TUAN');
        
        const qr = paymentMethod === 'Bank' 
          ? `https://img.vietqr.io/image/${bankId}-${accountNumber}-compact2.jpg?amount=${finalTotal}&addInfo=${encodeURIComponent(`Thanh toan ${tempRef}`)}&accountName=${accountName}`
          : `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=momo://pay?phoneNumber=${paymentSettings?.momoPhone || '0987654321'}&amount=${finalTotal}&note=Thanh%20toan%20${tempRef}`;
        
        setPendingOrderData(orderData);
        setQrUrl(qr);
        setStep('payment');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      const message = error.response?.data?.message || 'Lỗi kết nối server, vui lòng thử lại sau';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!pendingOrderData) return;
    
    setLoading(true);
    try {
      const response = await api.post('/orders', pendingOrderData);
      
      for (const id of selectedItemIds) {
        await removeFromCart(id);
      }
      
      onSuccess(response.data.order);
      onClose();
      toast.success('Thanh toán thành công! Đơn hàng của bạn đã được ghi nhận.');
    } catch (error: any) {
      console.error('Finalize order error:', error);
      toast.error(error.response?.data?.message || 'Lỗi khi tạo đơn hàng, vui lòng liên hệ hỗ trợ');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 'payment') {
      setCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl"
          >
            <button 
              onClick={handleClose}
              className="absolute top-8 right-8 p-2 hover:bg-stone-100 rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>

            <div className="p-10 max-h-[90vh] overflow-y-auto">
              {step === 'details' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="font-serif text-3xl mb-2">Thanh toán</h3>
                    <p className="text-stone-400 text-xs uppercase tracking-widest">Hoàn tất món quà hoa của bạn</p>
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-stone-500 font-bold bg-stone-50 rounded-3xl">Giỏ hàng của bạn đang trống</div>
                  ) : (
                    <div className="bg-stone-50 rounded-[32px] p-4 space-y-3">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-stone-100/50">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded border-stone-200 text-black focus:ring-black cursor-pointer"
                            checked={selectedItemIds.includes(item.id)}
                            onChange={() => toggleSelection(item.id)}
                          />
                          <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl" />
                          <div className="flex-1">
                            <h4 className="font-bold text-sm line-clamp-1">{item.name}</h4>
                            <p className="text-stone-500 text-xs font-bold mt-1">{(user?.isVIP ? item.price / 0.8 : item.price).toLocaleString('vi-VN')} đ</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                              <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-400 hover:text-red-500 transition-colors">
                                  <Trash2 size={16} />
                              </button>
                              <div className="flex flex-col items-end">
                                <div className="flex items-center gap-3 bg-stone-50 rounded-full px-2 py-1">
                                  <button 
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)} 
                                    className="p-1 hover:bg-stone-200 rounded-full transition-colors"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="text-xs font-bold min-w-[20px] text-center">{item.quantity}</span>
                                  <button 
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)} 
                                    disabled={item.quantity >= item.stock}
                                    className={`p-1 rounded-full transition-colors ${item.quantity >= item.stock ? 'opacity-30 cursor-not-allowed' : 'hover:bg-stone-200'}`}
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                                {item.quantity >= item.stock && (
                                  <span className="text-[9px] text-amber-600 font-bold mt-1 uppercase tracking-tighter">
                                    Tối đa trong kho: {item.stock}
                                  </span>
                                )}
                              </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {cart.length > 0 && (
                    <>
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Địa chỉ giao hàng</label>
                      <div className="grid grid-cols-2 gap-4">
                        <input 
                          type="text" 
                          placeholder="Quận/Huyện" 
                          className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                          value={address.district}
                          onChange={e => setAddress({...address, district: e.target.value})}
                        />
                        <input 
                          type="text" 
                          placeholder="Phường/Xã" 
                          className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                          value={address.ward}
                          onChange={e => setAddress({...address, ward: e.target.value})}
                        />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Số nhà, tên đường" 
                        className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                        value={address.street}
                        onChange={e => setAddress({...address, street: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Ngày giao hàng</label>
                        <input 
                          type="date" 
                          className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                          value={deliveryDate}
                          onChange={e => setDeliveryDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Khung giờ</label>
                        <select 
                          className="w-full p-4 bg-stone-50 rounded-2xl border-none focus:ring-2 focus:ring-black text-sm"
                          value={deliveryTime}
                          onChange={e => setDeliveryTime(e.target.value)}
                        >
                          {timeSlots.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Lời chúc trên thiệp</label>
                      <textarea 
                        value={cardMessage}
                        onChange={(e) => setCardMessage(e.target.value)}
                        placeholder="Viết lời chúc chân thành của bạn tại đây..."
                        className="w-full h-24 p-6 bg-stone-50 rounded-3xl border-none focus:ring-2 focus:ring-black transition-all resize-none text-sm italic"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Phương thức thanh toán</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'COD', label: 'Tiền mặt' },
                          { id: 'Bank', label: 'Chuyển khoản' },
                          { id: 'MoMo', label: 'Ví MoMo' }
                        ].map((method) => (
                          <button
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id as any)}
                            className={`p-4 rounded-2xl border-2 transition-all text-xs font-bold ${
                              paymentMethod === method.id 
                                ? 'border-black bg-black text-white' 
                                : 'border-stone-100 bg-stone-50 text-stone-400 hover:border-stone-200'
                            }`}
                          >
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl">
                      <input 
                        type="checkbox" 
                        id="policy"
                        className="mt-1 rounded border-amber-200 text-black focus:ring-black"
                        checked={policyAccepted}
                        onChange={e => setPolicyAccepted(e.target.checked)}
                      />
                      <label htmlFor="policy" className="text-[11px] text-amber-800 leading-relaxed">
                        Tôi đã đọc và đồng ý với <strong>Chính sách hủy đơn</strong> (Hủy trước 6 tiếng so với giờ giao để được hoàn tiền 100%).
                      </label>
                    </div>
                  </div>

                  <div className="bg-stone-50 p-6 rounded-3xl space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-400">Tạm tính ({selectedItems.reduce((a, b) => a + b.quantity, 0)} sản phẩm)</span>
                          <span>{rawSubtotal.toLocaleString('vi-VN')} đ</span>
                        </div>
                        {user?.isVIP && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span className="font-bold flex items-center gap-1">Khách hàng VIP (-20%)</span>
                            <span>-{((rawSubtotal) * 0.2).toLocaleString('vi-VN')} đ</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-400">Phí vận chuyển</span>
                          <span>{selectedShipping === 0 ? 'Miễn phí' : `${selectedShipping.toLocaleString('vi-VN')} đ`}</span>
                        </div>
                        <div className="pt-3 border-t border-stone-200 flex justify-between items-center">
                          <span className="font-serif text-xl">Tổng cộng</span>
                          <span className="font-bold text-xl">{selectedTotal.toLocaleString('vi-VN')} đ</span>
                        </div>
                      </div>

                      <button
                        onClick={handleCheckout}
                        disabled={loading || selectedItems.length === 0}
                        className="w-full bg-black text-white py-5 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {!user ? 'Vui lòng đăng nhập để đặt hàng' : loading ? <><Loader2 size={18} className="animate-spin" /> Đang xử lý...</> : `Xác nhận đặt hàng (${paymentMethod === 'COD' ? 'Tiền mặt' : paymentMethod === 'Bank' ? 'Chuyển khoản' : 'MoMo'})`}
                      </button>
                    </>
                  )}
                </div>
              )}

              {step === 'payment' && (
                <div className="text-center space-y-8">
                  <div>
                    <h3 className="font-serif text-3xl mb-2">Quét mã thanh toán</h3>
                    <p className="text-stone-400 text-xs uppercase tracking-widest">
                      {paymentMethod === 'Bank' ? `${paymentSettings?.bankName || 'Ngân hàng'} • VietQR` : 'Ví MoMo'}
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-3xl border-2 border-stone-100 inline-block">
                    <img src={qrUrl} alt="VietQR" className="w-64 h-64 object-contain" referrerPolicy="no-referrer" />
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-stone-500">
                      Vui lòng quét mã QR để thanh toán qua ứng dụng ngân hàng của bạn.
                    </p>
                    <button
                      onClick={handlePaymentSuccess}
                      disabled={loading}
                      className="w-full bg-black text-white py-5 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <><Loader2 size={18} className="animate-spin" /> Đang tạo đơn hàng...</> : 'Tôi đã thanh toán'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          <ConfirmModal
            isOpen={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            onConfirm={processOrder}
            title="Xác nhận đặt hàng"
            message="Bạn có chắc chắn muốn đặt hàng với thông tin đã chọn? Đơn hàng sẽ được chuyển đến bộ phận chuẩn bị ngay lập tức."
            confirmText="Đồng ý đặt hàng"
            cancelText="Kiểm tra lại"
          />
          <ConfirmModal
            isOpen={closeConfirmOpen}
            onClose={() => setCloseConfirmOpen(false)}
            onConfirm={onClose}
            title="Thanh toán chưa hoàn tất"
            message="Bạn chưa hoàn tất thanh toán, đơn hàng sẽ không được lưu. Bạn có chắc chắn muốn thoát?"
            confirmText="Đồng ý thoát"
            cancelText="Tiếp tục thanh toán"
            type="danger"
          />
        </div>
      )}
    </AnimatePresence>
  );
}
