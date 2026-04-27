import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin', 'staff', 'shipper'], default: 'customer' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  permissions: [{ type: String }],
  phone: { type: String },
  address: { type: String },
  notes: { type: String },
  isVIP: { type: Boolean, default: false },
  isFirstLogin: { type: Boolean, default: true },
  passwordChangedAt: { type: Date },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  discount: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  isHidden: { type: Boolean, default: false },
  isStackable: { type: Boolean, default: false },
  occasions: [{ type: String }],
  color: { type: String },
  image: { type: String, required: true },
  category: { type: String, required: true },
  stock: { type: Number, default: 0, min: 0 },
  minStock: { type: Number, default: 5 },
  unit: { type: String, default: 'bó' },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priceHistory: [{
    oldPrice: Number,
    newPrice: Number,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
  }],
  version: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  email: { type: String },
  mainCategory: { type: String }
}, { timestamps: true });

const importTicketSchema = new mongoose.Schema({
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName: { type: String },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    quantity: { type: Number, required: true },
    importPrice: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  performedBy: { type: String },
  notes: { type: String }
}, { timestamps: true });

const exportTicketSchema = new mongoose.Schema({
  type: { type: String, enum: ['sale', 'waste'], default: 'sale' },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    quantity: { type: Number, required: true }
  }],
  performedBy: { type: String },
  notes: { type: String }
}, { timestamps: true });

const inventoryLogSchema = new mongoose.Schema({
  type: { type: String, enum: ['import', 'export', 'waste'], required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  quantity: { type: Number, required: true },
  price: { type: Number }, // Import price
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: { type: String },
  reason: { type: String }, // e.g., 'bán hàng', 'hoa héo', 'nhập mới'
  performedBy: { type: String },
  ticketId: { type: mongoose.Schema.Types.ObjectId } // Ref to ImportTicket or ExportTicket
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    product: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    costPrice: { type: Number, default: 0 },
    quantity: { type: Number, required: true },
    image: { type: String }
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'ready', 'shipping', 'delivered', 'completed', 'cancelled', 'failed', 'refunded', 'returned'], default: 'pending' },
  deliveryDate: { type: String },
  deliveryTime: { type: String },
  cardMessage: { type: String },
  address: {
    district: { type: String, required: true },
    ward: { type: String, required: true },
    street: { type: String, required: true }
  },
  paymentMethod: { type: String, enum: ['COD', 'Bank', 'MoMo'], default: 'COD' },
  isPaid: { type: Boolean, default: false },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedBy: { type: String },
  deliveredBy: { type: String },
  shipperId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  statusHistory: [{
    status: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
      role: { type: String }
    }
  }],
  actionHistory: [{
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffName: { type: String },
    action: { type: String },
    oldValue: { type: String },
    newValue: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  editHistory: [{
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffName: { type: String },
    field: { type: String },
    oldValue: { type: String },
    newValue: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  returnStatus: { 
    type: String, 
    enum: ['None', 'Requested', 'Approved', 'Rejected', 'Completed'],
    default: 'None'
  },
  returnReason: { type: String },
  failedReason: { type: String },
  returnImages: [{ type: String }],
  refundAmount: { type: Number, default: 0 },
  reviewed: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true, optimisticConcurrency: true });

const reviewSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  productId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true }
}, { timestamps: true });

const settingSchema = new mongoose.Schema({
  heroImage: { type: String, required: true },
  heroTitle: { type: String, required: true },
  heroSubtitle: { type: String, required: true },
  bankName: { type: String, default: 'Vietcombank' },
  accountNumber: { type: String, default: '123456789' },
  accountHolder: { type: String, default: 'NGUYEN VAN A' },
  momoPhone: { type: String, default: '0987654321' },
  hotline: { type: String, default: '0123 456 789' },
  address: { type: String, default: '123 Đường Hoa, Quận 1, TP. HCM' },
  facebook: { type: String, default: 'https://facebook.com' },
  instagram: { type: String, default: 'https://instagram.com' },
  zalo: { type: String, default: '0123456789' }
});

const shiftSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffName: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  startCash: { type: Number, default: 0 },
  actualCashReceived: { type: Number, default: 0 },
  totalOrderCash: { type: Number, default: 0 },
  expectedCash: { type: Number, default: 0 },
  difference: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  notes: { type: String }
}, { timestamps: true });

// Ensure virtual id is included in JSON for all models
const toJSONConfig = {
  virtuals: true,
  versionKey: true,
  transform: function (doc: any, ret: any) {
    ret.id = ret._id;
    delete ret._id;
  }
};

userSchema.set('toJSON', toJSONConfig);
productSchema.set('toJSON', toJSONConfig);
orderSchema.set('toJSON', toJSONConfig);
reviewSchema.set('toJSON', toJSONConfig);
settingSchema.set('toJSON', toJSONConfig);
supplierSchema.set('toJSON', toJSONConfig);
importTicketSchema.set('toJSON', toJSONConfig);
exportTicketSchema.set('toJSON', toJSONConfig);
inventoryLogSchema.set('toJSON', toJSONConfig);
shiftSchema.set('toJSON', toJSONConfig);

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 }
  }]
}, { timestamps: true });

function softDeletePlugin(schema: mongoose.Schema) {
  schema.pre('find', function() {
    this.where({ isDeleted: { $ne: true } });
  });
  schema.pre('findOne', function() {
    this.where({ isDeleted: { $ne: true } });
  });
  schema.pre('countDocuments', function() {
    this.where({ isDeleted: { $ne: true } });
  });
  schema.pre('aggregate', function() {
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  });
}

userSchema.plugin(softDeletePlugin);
productSchema.plugin(softDeletePlugin);
orderSchema.plugin(softDeletePlugin);

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  action: { type: String, required: true },
  targetId: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });
auditLogSchema.set('toJSON', toJSONConfig);

export const User = mongoose.model('User', userSchema);
export const Product = mongoose.model('Product', productSchema);
export const Order = mongoose.model('Order', orderSchema);
export const Review = mongoose.model('Review', reviewSchema);
export const Setting = mongoose.model('Setting', settingSchema);
export const Supplier = mongoose.model('Supplier', supplierSchema);
export const InventoryLog = mongoose.model('InventoryLog', inventoryLogSchema);
export const ImportTicket = mongoose.model('ImportTicket', importTicketSchema);
export const ExportTicket = mongoose.model('ExportTicket', exportTicketSchema);
export const Shift = mongoose.model('Shift', shiftSchema);
export const Cart = mongoose.model('Cart', cartSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
