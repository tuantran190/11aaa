import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Upload, Trash2, Send } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  productId: string;
  onSuccess: () => void;
}

export default function ReviewModal({ isOpen, onClose, orderId, productId, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (images.length + files.length > 3) {
      toast.error('Bạn chỉ có thể tải lên tối đa 3 hình ảnh');
      return;
    }
    
    // Check if any file > 10MB
    const hasLargeFile = Array.from(files).some((file: any) => file.size > 10 * 1024 * 1024);
    if (hasLargeFile) {
      toast.custom((t) => (
        <div className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl shadow-lg">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-xs font-medium">File quá lớn, hệ thống đang tự động nén ảnh cho bạn...</span>
        </div>
      ), { duration: 3000 });
    }

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file: any) => {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          initialQuality: 0.8
        };
        const compressedFile = await imageCompression(file, options);
        
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedFile);
        });
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      setImages([...images, ...uploadedUrls]);
      toast.success('Tải ảnh lên thành công');
    } catch (err) {
      toast.error('Không thể tải ảnh lên');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment) {
      toast.error('Vui lòng để lại bình luận');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/orders/${orderId}/review`, {
        rating,
        comment,
        images,
        productId
      });
      toast.success('Cảm ơn bạn đã đánh giá!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
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
            className="relative bg-white w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl p-10"
          >
            <button 
              onClick={onClose}
              className="absolute top-8 right-8 p-2 hover:bg-stone-100 rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>

            <div className="space-y-8">
              <div>
                <h3 className="font-serif text-3xl mb-2">Đánh giá đơn hàng</h3>
                <p className="text-stone-400 text-xs uppercase tracking-widest">Chia sẻ trải nghiệm của bạn về {orderId}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-2 transition-all ${rating >= star ? 'text-amber-400 scale-110' : 'text-stone-200'}`}
                    >
                      <Star size={32} fill={rating >= star ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Bình luận của bạn</label>
                  <textarea
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Hoa rất đẹp, giao hàng đúng hẹn..."
                    className="w-full h-32 p-6 bg-stone-50 rounded-3xl border-none focus:ring-2 focus:ring-black transition-all resize-none text-sm italic"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Hình ảnh thực tế (Tối đa 3)</label>
                  <div className="grid grid-cols-3 gap-4">
                    {images.map((url, index) => (
                      <div key={index} className="relative aspect-square rounded-2xl overflow-hidden group">
                        <img src={url} alt="Review" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages(images.filter((_, i) => i !== index))}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {images.length < 3 && (
                      <label className="aspect-square bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center cursor-pointer hover:border-black transition-all">
                        {uploading ? (
                          <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <>
                            <Upload size={20} className="text-stone-400 mb-1" />
                            <span className="text-[8px] uppercase font-bold text-stone-400">Tải ảnh</span>
                          </>
                        )}
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} />
                      </label>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="w-full bg-black text-white py-5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? 'Đang gửi...' : (
                    <>
                      <Send size={16} />
                      Gửi đánh giá
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
