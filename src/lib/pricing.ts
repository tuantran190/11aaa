import { Product, User } from '../types';

export interface PriceInfo {
  originalPrice: number;
  salePrice: number;
  vipPrice: number;
  finalPrice: number;
  isVIPUser: boolean;
  isVIPApplied: boolean;
  isStacked: boolean;
}

export const getDisplayPrice = (product: Partial<Product>, user?: Partial<User> | null): PriceInfo => {
  const originalPrice = product.originalPrice || product.price || 0;
  // Fallback to product.price if discount is missing but price was reduced manually
  const salePrice = product.discount ? originalPrice * (1 - product.discount / 100) : (product.price || 0);
  const isVIPUser = !!user?.isVIP;
  
  let finalPrice = salePrice;
  let vipPrice = originalPrice;
  let isStacked = false;
  let isVIPApplied = false;

  if (isVIPUser) {
    vipPrice = originalPrice * 0.8;
    
    if (product.isStackable) {
      finalPrice = salePrice * 0.8;
      isStacked = true;
      isVIPApplied = true;
    } else {
      finalPrice = Math.min(salePrice, vipPrice);
      if (finalPrice === vipPrice && vipPrice < salePrice) {
        isVIPApplied = true;
      }
    }
  }

  // To avoid floating point issues, truncate/round
  return {
    originalPrice: Math.round(originalPrice),
    salePrice: Math.round(salePrice),
    vipPrice: Math.round(vipPrice),
    finalPrice: Math.round(finalPrice),
    isVIPUser,
    isVIPApplied,
    isStacked
  };
};

export const calculateFinalPrice = (product: Partial<Product>, isVIP?: boolean): number => {
  return getDisplayPrice(product, { isVIP }).finalPrice;
};
