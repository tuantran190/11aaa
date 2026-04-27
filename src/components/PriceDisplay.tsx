import React from 'react';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { getDisplayPrice } from '../lib/pricing';

interface PriceDisplayProps {
  product: Partial<Product>;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function PriceDisplay({ product, className = '', size = 'md' }: PriceDisplayProps) {
  const { user } = useAuth();
  const priceInfo = getDisplayPrice(product, user);

  // Size variations
  const priceClass = size === 'lg' ? 'text-2xl font-bold mb-1' : size === 'md' ? 'text-lg font-bold mb-1' : 'text-base font-medium mb-1';
  const originalPriceClass = size === 'lg' ? 'ml-3 text-lg font-medium text-stone-400 line-through' : 'ml-2 text-sm font-medium text-stone-400 line-through';
  const badgeClass = size === 'lg' ? 'text-xs px-3 py-1' : 'text-[10px] px-2 py-1';

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div className="flex items-center flex-wrap gap-y-1">
        <p className={`text-red-600 ${priceClass}`}>
          {new Intl.NumberFormat('vi-VN').format(priceInfo.finalPrice)} đ
        </p>
        
        {priceInfo.finalPrice < priceInfo.originalPrice && (
          <p className={originalPriceClass}>
            {new Intl.NumberFormat('vi-VN').format(priceInfo.originalPrice)} đ
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 mt-1">
        {priceInfo.isStacked ? (
          <div className={`inline-flex items-center bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 rounded-md font-bold uppercase tracking-widest border border-yellow-300 ${badgeClass}`}>
            Double ưu đãi: Giảm thêm 20% cho VIP
          </div>
        ) : priceInfo.isVIPApplied ? (
          <div className={`inline-flex items-center bg-gradient-to-r from-stone-800 to-stone-900 text-amber-300 rounded-md font-bold uppercase tracking-widest border border-stone-700 ${badgeClass}`}>
            GIÁ ĐẶC QUYỀN VIP
          </div>
        ) : product.discount ? (
          <div className={`inline-flex items-center bg-red-50 text-red-600 rounded-md font-bold uppercase tracking-widest border border-red-100 ${badgeClass}`}>
            Sale {product.discount}%
          </div>
        ) : null}
      </div>
    </div>
  );
}
