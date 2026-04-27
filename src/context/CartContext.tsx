import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';
import { useAuth } from './AuthContext';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { calculateFinalPrice } from '../lib/pricing';

interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  shipping: number;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const SHIPPING_FEE = 20000;

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cartState, setCart] = useState<CartItem[]>([]);

  const fetchCart = async () => {
    try {
      const res = await api.get('/cart');
      if (res.data && res.data.items) {
        const formattedCart = res.data.items.map((item: any) => ({
          ...item.productId,
          id: item.productId._id || item.productId.id,
          quantity: item.quantity
        }));
        setCart(formattedCart);
      }
    } catch (error) {
      console.error('Failed to fetch cart', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setCart([]);
    }
  }, [user]);

  const addToCart = async (product: Product) => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để thêm vào giỏ hàng');
      return;
    }

    const currentItem = cartState.find(item => item.id === product.id);
    const currentQuantity = currentItem ? currentItem.quantity : 0;

    if (currentQuantity + 1 > product.stock) {
      toast.error(`Rất tiếc, sản phẩm này chỉ còn ${product.stock} mẫu hoa.`);
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    try {
      await api.post('/cart/add', { productId: product.id, quantity: 1 });
    } catch (error: any) {
      console.error('Failed to add to cart', error);
      toast.error(error.response?.data?.message || 'Không thể thêm vào giỏ hàng');
      fetchCart(); 
    }
  };

  const removeFromCart = async (productId: string) => {
    if (!user) return;
    
    setCart(prev => prev.filter(item => item.id !== productId));
    
    try {
      await api.delete(`/cart/${productId}`);
    } catch (error) {
      console.error('Failed to remove from cart', error);
      fetchCart(); 
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!user || quantity < 1) return;

    const item = cartState.find(i => i.id === productId);
    if (!item) return;

    if (quantity > item.stock) {
      toast.error(`Rất tiếc, chúng tôi chỉ còn ${item.stock} mẫu hoa này.`);
      return;
    }
    
    setCart(prev => prev.map(item => 
      item.id === productId ? { ...item, quantity } : item
    ));
    
    try {
      await api.put(`/cart/${productId}`, { quantity });
    } catch (error: any) {
      console.error('Failed to update quantity', error);
      toast.error(error.response?.data?.message || 'Không thể cập nhật số lượng');
      fetchCart();
    }
  };

  const clearCart = async () => {
    if (!user) {
      setCart([]);
      localStorage.removeItem('cart');
      return;
    }
    
    setCart([]);
    localStorage.removeItem('cart');
    
    try {
      await api.delete('/cart/clear');
    } catch (error) {
      console.error('Failed to clear cart on server', error);
    }
  };

  // Calculate dynamic cart based on VIP status
  const cart = cartState.map(item => ({
    ...item,
    price: calculateFinalPrice(item, user?.isVIP)
  }));

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = cart.length > 0 ? (user?.isVIP ? 0 : SHIPPING_FEE) : 0;
  const total = subtotal + shipping;

  return (
    <CartContext.Provider value={{ 
      cart, addToCart, removeFromCart, updateQuantity, clearCart,
      subtotal, shipping, total 
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
