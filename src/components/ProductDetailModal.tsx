import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, ShoppingBag, MessageSquare, CornerDownRight, Loader2 } from 'lucide-react';
import { Product, Review } from '../types';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { calculateFinalPrice } from '../lib/pricing';

import PriceDisplay from './PriceDisplay';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
}

export default function ProductDetailModal({ product, isOpen, onClose, onAddToCart }: ProductDetailModalProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      fetchReviews();
    }
  }, [isOpen, product]);

  const fetchReviews = async () => {
    if (!product) return;
    setLoading(true);
    try {
      // We need an endpoint to get reviews by product ID
      const res = await api.get(`/products/${product.id}/reviews`);
      setReviews(res.data);
    } catch (err) {
      console.error('Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 bg-white/80 backdrop-blur-md hover:bg-white rounded-full transition-colors z-10 shadow-sm"
            >
              <X size={20} />
            </button>

            {/* Product Image */}
            <div className="w-full md:w-1/2 aspect-square md:aspect-auto bg-stone-100">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Product Info & Reviews */}
            <div className="w-full md:w-1/2 flex flex-col h-full overflow-hidden">
              <div className="p-8 md:p-10 overflow-y-auto flex-1 space-y-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold mb-2">{product.category}</p>
                  <h2 className="font-serif text-4xl mb-4">{product.name}</h2>
                  <PriceDisplay product={product} size="lg" />
                </div>

                <div className="space-y-4">
                  <p className="text-stone-500 text-sm leading-relaxed italic">
                    "Mỗi bó hoa tại Midnight Rose đều được nghệ nhân cắm hoa tỉ mỉ lựa chọn từ những bông hoa tươi nhất trong ngày, mang đến vẻ đẹp tinh tế và sang trọng."
                  </p>
                  <button
                    onClick={async () => {
                      setIsSubmitting(true);
                      try {
                        await onAddToCart(product);
                        toast.success(`Đã thêm ${product.name} vào giỏ hàng`);
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={product.stock <= 0 || isSubmitting}
                    className="w-full bg-black text-white py-5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
                    {product.stock > 0 ? (isSubmitting ? 'Đang thêm...' : 'Thêm vào giỏ hàng') : 'Hết hàng'}
                  </button>
                </div>

                <div className="pt-8 border-t border-stone-100 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-xl">Đánh giá từ khách hàng</h3>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star size={14} fill="currentColor" />
                      <span className="text-sm font-bold text-stone-900">4.9</span>
                      <span className="text-xs text-stone-400 font-normal">({reviews.length})</span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {loading ? (
                      <div className="flex justify-center py-10">
                        <div className="w-6 h-6 border-2 border-stone-200 border-t-black rounded-full animate-spin" />
                      </div>
                    ) : reviews.length > 0 ? (
                      reviews.map((review) => (
                        <div key={review.id} className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-bold">{review.customerName}</p>
                              <div className="flex gap-0.5 text-amber-400 mt-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} size={10} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-stone-200"} />
                                ))}
                              </div>
                            </div>
                            <span className="text-[10px] text-stone-400">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <p className="text-xs text-stone-600 leading-relaxed">{review.comment}</p>
                          
                          {review.images && review.images.length > 0 && (
                            <div className="flex gap-2">
                              {review.images.map((img, i) => (
                                <img key={i} src={img} alt="" className="w-12 h-12 rounded-lg object-cover border border-stone-100" />
                              ))}
                            </div>
                          )}

                          {review.reply && (
                            <div className="ml-4 mt-4 p-4 bg-stone-50 rounded-2xl border-l-2 border-stone-200 space-y-2">
                              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-stone-400">
                                <CornerDownRight size={12} />
                                Midnight Rose phản hồi
                              </div>
                              <p className="text-xs italic text-stone-500 leading-relaxed">{review.reply}</p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 bg-stone-50 rounded-3xl">
                        <MessageSquare size={32} className="mx-auto text-stone-200 mb-2" />
                        <p className="text-stone-400 text-xs">Chưa có đánh giá nào cho sản phẩm này.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
