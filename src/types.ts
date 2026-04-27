export type Role = 'customer' | 'staff' | 'shipper' | 'admin';

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  isStackable?: boolean;
  occasions?: string[];
  color?: string;
  image: string;
  category: string;
  stock: number;
  minStock?: number;
  unit?: string;
  createdBy?: { id: string; name: string };
  priceHistory?: {
    oldPrice: number;
    newPrice: number;
    updatedBy: { id: string; name: string };
    updatedAt: string;
  }[];
  createdAt?: string;
}

export interface Order {
  id: string;
  customer: string;
  items: {
    product: string;
    name: string;
    quantity: number;
    price: number;
    image: string;
  }[];
  totalAmount: number;
  deliveryDate: string;
  deliveryTime: string;
  cardMessage: string;
  address: {
    district: string;
    ward: string;
    street: string;
  };
  paymentMethod: 'COD' | 'Bank' | 'MoMo';
  isPaid: boolean;
  staffId?: string;
  shiftId?: string;
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'shipping' | 'delivered' | 'completed' | 'failed' | 'refunded' | 'cancelled' | 'returned';
  statusHistory?: {
    status: string;
    updatedBy: { id: string; name: string; role?: 'admin' | 'staff' | 'shipper' | 'customer' };
    updatedAt: string;
  }[];
  failedReason?: string;
  confirmedBy?: string;
  deliveredBy?: string;
  shipperId?: string;
  processedBy?: { id: string; name: string };
  actionHistory?: {
    staffId: string;
    staffName: string;
    action: string;
    oldValue: string;
    newValue: string;
    timestamp: string;
  }[];
  editHistory?: {
    staffId: string;
    staffName: string;
    field: string;
    oldValue: string;
    newValue: string;
    timestamp: string;
  }[];
  returnStatus?: 'None' | 'Requested' | 'Approved' | 'Rejected' | 'Completed';
  returnReason?: string;
  returnImages?: string[];
  refundAmount?: number;
  reviewed?: boolean;
  __v?: number;
  createdAt: string;
}

export interface Review {
  id: string;
  orderId: string;
  productId: string;
  customer: string;
  customerName: string;
  comment: string;
  rating: number;
  images: string[];
  reply?: string;
  repliedAt?: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status?: 'active' | 'inactive';
  permissions?: string[];
  phone?: string;
  address?: string;
  notes?: string;
  totalSpent?: number;
  isVIP?: boolean;
  requirePasswordChange?: boolean;
}

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  startTime: string;
  endTime?: string;
  startCash: number;
  actualCashReceived: number;
  totalOrderCash: number;
  expectedCash: number;
  difference: number;
  status: 'open' | 'closed';
  notes?: string;
  createdAt: string;
}
