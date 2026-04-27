import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle, Package, MapPin, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Order } from '../types';

interface OrderSuccessProps {
  order: Order;
  onContinue: () => void;
}

export default function OrderSuccess({ order, onContinue }: OrderSuccessProps) {
  return (
    <div className="max-w-2xl mx-auto py-20 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[40px] p-10 shadow-2xl border border-stone-100 text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500">
            <CheckCircle size={40} />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-serif text-4xl">Đặt hàng thành công!</h2>
          <p className="text-stone-400 uppercase tracking-widest text-xs font-bold">Mã đơn hàng: #{order.id}</p>
        </div>

        <div className="bg-stone-50 rounded-3xl p-8 text-left space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-200">
            <span className="text-xs uppercase tracking-widest text-stone-400 font-bold">Trạng thái</span>
            <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] uppercase tracking-widest rounded-full font-bold">Chờ xác nhận</span>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-stone-400 font-bold">Tóm tắt đơn hàng</h4>
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <span className="text-stone-600">{item.name || 'Sản phẩm'} x{item.quantity}</span>
                <span className="font-medium">{(item.price * item.quantity).toLocaleString('vi-VN')} đ</span>
              </div>
            ))}
            <div className="pt-4 border-t border-stone-200 flex justify-between items-center font-bold">
              <span>Tổng cộng</span>
              <span className="text-xl font-serif">{order.totalAmount.toLocaleString('vi-VN')} đ</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-400">
                <Calendar size={14} />
                <span className="text-[10px] uppercase tracking-widest font-bold">Ngày giao</span>
              </div>
              <p className="text-sm">{order.deliveryDate}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-stone-400">
                <Clock size={14} />
                <span className="text-[10px] uppercase tracking-widest font-bold">Khung giờ</span>
              </div>
              <p className="text-sm">{order.deliveryTime}</p>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-2 text-stone-400">
              <MapPin size={14} />
              <span className="text-[10px] uppercase tracking-widest font-bold">Địa chỉ nhận hoa</span>
            </div>
            <p className="text-sm leading-relaxed">
              {order.address.street}, {order.address.ward}, {order.address.district}, Đà Nẵng
            </p>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full bg-black text-white py-5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all flex items-center justify-center gap-2 group"
        >
          Tiếp tục mua sắm
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </motion.div>
    </div>
  );
}
