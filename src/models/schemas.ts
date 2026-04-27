import mongoose, { Schema, Document } from 'mongoose';

// --- User Schema ---
export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'customer' | 'staff' | 'shipper' | 'admin';
  phone?: string;
  address?: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['customer', 'staff', 'shipper', 'admin'], 
    default: 'customer' 
  },
  phone: { type: String },
  address: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// --- Product Schema ---
export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  stock: number;
  isFeatured: boolean;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  images: [{ type: String }],
  category: { type: String, required: true },
  stock: { type: Number, default: 0 },
  isFeatured: { type: Boolean, default: false }
});

// --- Order Schema ---
export interface IOrder extends Document {
  customer: mongoose.Types.ObjectId;
  items: {
    product: mongoose.Types.ObjectId;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  shippingAddress: string;
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'shipping' | 'delivered' | 'failed' | 'refunded' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed';
  paymentMethod: 'qr' | 'cod';
  statusHistory: {
    status: string;
    updatedAt: Date;
    updatedBy: { id: mongoose.Types.ObjectId; name: string };
  }[];
  
  // Specific requirements
  cardMessage?: string; // Lời chúc trên thiệp
  shipper?: mongoose.Types.ObjectId; // ID của Shipper đảm nhận
  
  deliveryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema: Schema = new Schema({
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  shippingAddress: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'ready', 'shipping', 'delivered', 'failed', 'refunded', 'cancelled'], 
    default: 'pending' 
  },
  statusHistory: [{
    status: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: {
      id: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String }
    }
  }],
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed'], 
    default: 'pending' 
  },
  paymentMethod: { 
    type: String, 
    enum: ['qr', 'cod'], 
    default: 'qr' 
  },
  
  // Specific requirements
  cardMessage: { type: String },
  shipper: { type: Schema.Types.ObjectId, ref: 'User' },
  
  deliveryDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
export const Product = mongoose.model<IProduct>('Product', ProductSchema);
export const Order = mongoose.model<IOrder>('Order', OrderSchema);
