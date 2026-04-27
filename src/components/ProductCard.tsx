import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, AlertCircle, Loader2 } from 'lucide-react';
import { Product } from '../types';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { calculateFinalPrice } from '../lib/pricing';

import PriceDisplay from './PriceDisplay';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => Promise<void> | void;
  key?: React.Key;
  highlightIndices?: readonly [number, number][];
}

const renderHighlightedText = (text: string, indices?: readonly [number, number][]) => {
  if (!indices || indices.length === 0) return text;
  
  let lastIndex = 0;
  const result: React.ReactNode[] = [];
  
  indices.forEach(([start, end], i) => {
    if (start > lastIndex) {
      result.push(<span key={`${i}-normal`}>{text.slice(lastIndex, start)}</span>);
    }
    result.push(
      <span key={`${i}-highlight`} className="font-extrabold text-black bg-yellow-200">
        {text.slice(start, end + 1)}
      </span>
    );
    lastIndex = end + 1;
  });
  
  if (lastIndex < text.length) {
    result.push(<span key="last-normal">{text.slice(lastIndex)}</span>);
  }
  
  return result;
};

export default function ProductCard({ product, onAddToCart, highlightIndices }: ProductCardProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock < 5;

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock || isSubmitting) {
      if (isOutOfStock) toast.error('Sản phẩm này hiện đã hết hàng');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onAddToCart(product);
      toast.success(`Đã thêm ${product.name} vào giỏ hàng`);
    } catch (err) {
      // errors handled by addToCart context usually, but just in case
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[3/4] rounded-[32px] overflow-hidden mb-6 bg-stone-100 shadow-sm group-hover:shadow-xl transition-all duration-500">
        <img 
          src={product.image} 
          alt={product.name}
          className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out ${isOutOfStock ? 'grayscale opacity-60' : ''}`}
          referrerPolicy="no-referrer"
        />
        
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-2 shadow-lg">
              <AlertCircle size={16} className="text-stone-400" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-600">Hết hàng</span>
            </div>
          </div>
        )}

        {isLowStock && !isOutOfStock && (
          <div className="absolute top-6 left-6">
            <div className="bg-amber-500/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg">
              <span className="text-[9px] uppercase tracking-[0.1em] font-bold text-white">Chỉ còn vài mẫu cuối</span>
            </div>
          </div>
        )}

        {(product.discount ?? 0) > 0 && !isOutOfStock && (
          <div className="absolute top-6 right-6 animate-pulse">
            <div className="bg-red-500/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg">
              <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-white">-{product.discount}% OFF</span>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
        
        {!isOutOfStock && (
          <button 
            onClick={handleAdd}
            disabled={isSubmitting}
            className="absolute bottom-6 right-6 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 hover:bg-black hover:text-white disabled:bg-stone-100 disabled:text-stone-400"
          >
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <ShoppingBag size={20} strokeWidth={1.5} />}
          </button>
        )}
      </div>
      
      <div className="space-y-1 px-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-bold">
          {product.category === 'Roses' ? 'Bó hoa' : product.category === 'Lilies' ? 'Lẵng hoa' : product.category === 'Seasonal' ? 'Hoa mùa' : product.category}
        </p>
        <h3 className="font-serif text-2xl text-stone-800 group-hover:text-black transition-colors">
          {renderHighlightedText(product.name, highlightIndices)}
        </h3>
        
        <PriceDisplay product={product} size="md" className="mb-4" />

        {isOutOfStock ? (
          <button className="w-full py-3 border border-stone-200 rounded-full text-[10px] uppercase tracking-widest font-bold text-stone-400 hover:bg-stone-50 transition-all">
            Liên hệ tư vấn mẫu tương tự
          </button>
        ) : (
          <button 
            onClick={handleAdd}
            disabled={isSubmitting}
            className="w-full py-3 bg-stone-50 rounded-full text-[10px] uppercase tracking-widest font-bold text-stone-600 hover:bg-black hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-stone-50 flex justify-center items-center gap-2"
          >
            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Đang thêm...</> : 'Thêm vào giỏ hàng'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
