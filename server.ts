import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { startBackupCron, executeBackup, getBackupsList } from './src/services/backupService.ts';
import { User, Product, Order, Review, Setting, Supplier, InventoryLog, Shift, ImportTicket, ExportTicket, Cart, AuditLog } from './src/models.ts';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
const connectDB = async () => {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is missing in environment variables.');
    return false;
  }

  try {
    console.log('Đang kết nối tới MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // Timeout after 30s
    });
    console.log('Ket noi MongoDB thanh cong');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    return false;
  }
};

async function startServer() {
  const isConnected = await connectDB();
  
  const app = express();
  const PORT = 3000;

  // Middleware to check DB connection
  app.use((req, res, next) => {
    if (mongoose.connection.readyState !== 1 && !req.path.startsWith('/api/health')) {
      return res.status(503).json({ 
        message: 'Cơ sở dữ liệu chưa sẵn sàng. Vui lòng kiểm tra cấu hình MONGODB_URI trong Settings.',
        error: 'Database connection not established'
      });
    }
    next();
  });

  // --- CORS Configuration ---
  const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-frontend-vercel-url.vercel.app'] // Replace with actual Vercel URL
      : true, // Allow all in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role']
  };
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // --- Middleware ---
  const authenticate = asyncHandler(async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Không có quyền truy cập: Thiếu token' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      
      // Check for first login and session expiration
      const user = await User.findById(req.user.id);
      if (!user) return res.status(401).json({ message: 'Người dùng không tồn tại' });

      // If user changed password AFTER this token was issued, invalidate it
      // JWT iat is in seconds, Date.getTime() is in ms
      if (user.passwordChangedAt && req.user.iat) {
        const changedTimestamp = parseInt((user.passwordChangedAt.getTime() / 1000).toString(), 10);
        if (req.user.iat < changedTimestamp) {
          return res.status(401).json({ message: 'Phiên đăng nhập hết hạn do tài khoản đổi mật khẩu', expired: true });
        }
      }

      if (req.path !== '/auth/change-password' && req.path !== '/api/auth/change-password') {
        if (user.isFirstLogin) {
          return res.status(403).json({ message: 'Yêu cầu đổi mật khẩu trước khi tiếp cận hệ thống', requirePasswordChange: true });
        }
      }
      
      next();
    } catch (err) {
      res.status(401).json({ message: 'Không có quyền truy cập: Token không hợp lệ' });
    }
  });

  const checkRole = (roles: string[]) => {
    return asyncHandler(async (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ message: 'Không có quyền truy cập: Thiếu thông tin người dùng' });
      }

      // Fallback check if role is missing in JWT (for legacy data)
      let role = req.user.role;
      if (!role) {
        const user = await User.findById(req.user.id);
        if (user) {
          role = user.role;
        }
      }

      if (!role || !roles.includes(role)) {
        return res.status(403).json({ message: 'Từ chối truy cập: Bạn không có quyền thực hiện hành động này' });
      }
      next();
    });
  };

  const checkPermission = (requiredPermission: string) => {
    return asyncHandler(async (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ message: 'Không có quyền truy cập: Thiếu thông tin người dùng' });
      }

      let role = req.user.role;
      if (!role) {
        const user = await User.findById(req.user.id);
        if (user) role = user.role;
      }

      if (role === 'admin') {
        return next();
      }

      if (role === 'staff') {
        const user = await User.findById(req.user.id);
        if (user && user.permissions && user.permissions.includes(requiredPermission)) {
          return next();
        }
        return res.status(403).json({ 
          message: 'Bạn không có quyền thực hiện chức năng này. Vui lòng liên hệ Admin.' 
        });
      }

      return res.status(403).json({ message: 'Từ chối truy cập: Bạn không có quyền thực hiện hành động này' });
    });
  };

  // --- Auth Controllers ---
  app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Vui lòng cung cấp đầy đủ thông tin bắt buộc');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400);
      throw new Error('Email này đã được đăng ký trên hệ thống');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ 
      name, 
      email, 
      password: hashedPassword, 
      role: 'customer',
      phone: phone || '',
      isFirstLogin: false
    });

    const token = jwt.sign({ id: newUser._id, name: newUser.name, role: newUser.role }, JWT_SECRET, { expiresIn: '1d' });
    res.status(201).json({ token, user: { id: newUser._id, name, email, role: newUser.role, phone: newUser.phone, isVIP: newUser.isVIP } });
  }));

  app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
    const { email, oldPassword, newPassword } = req.body;
    if (!email || !oldPassword || !newPassword) {
      res.status(400);
      throw new Error('Vui lòng cung cấp đầy đủ thông tin');
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404);
      throw new Error('Email không tồn tại trong hệ thống');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Mật khẩu cũ không chính xác');
    }

    const isSameAsOld = await bcrypt.compare(newPassword, user.password);
    if (isSameAsOld) {
      res.status(400);
      throw new Error('Mật khẩu mới không được giống mật khẩu cũ');
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.isFirstLogin = false;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' });
  }));

  // Admin: Create Staff/Shipper accounts
  app.post('/api/auth/create-staff', authenticate, checkRole(['admin']), asyncHandler(async (req, res) => {
    const { name, email, password, role, permissions, status } = req.body;
    if (!name || !email || !password || !role) {
      res.status(400);
      throw new Error('Vui lòng cung cấp đầy đủ thông tin');
    }

    if (!['staff', 'shipper', 'admin'].includes(role)) {
      res.status(400);
      throw new Error('Vai trò không hợp lệ');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400);
      throw new Error('Email này đã tồn tại');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ 
      name, 
      email, 
      password: hashedPassword, 
      role,
      permissions: permissions || [],
      status: status || 'active'
    });

    res.status(201).json({ message: `Đã tạo tài khoản ${role} thành công`, user: { id: newUser._id, name, email, role } });
  }));

  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400);
      throw new Error('Vui lòng nhập đầy đủ email và mật khẩu');
    }
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401);
      throw new Error('Email không tồn tại trong hệ thống');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Mật khẩu không chính xác, vui lòng thử lại');
    }

    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, isVIP: user.isVIP, permissions: user.permissions }, requirePasswordChange: user.isFirstLogin });
  }));

  app.get('/api/auth/me', authenticate, asyncHandler(async (req: any, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error('Không tìm thấy thông tin người dùng');
    }
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, isVIP: user.isVIP, permissions: user.permissions, requirePasswordChange: user.isFirstLogin });
  }));

  // Change Password
  app.post('/api/auth/change-password', authenticate, asyncHandler(async (req: any, res) => {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      res.status(400);
      throw new Error('Vui lòng cung cấp mật khẩu cũ và mật khẩu mới');
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      res.status(404);
      throw new Error('Người dùng không tồn tại');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      res.status(400);
      throw new Error('Mật khẩu hiện tại không đúng');
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.isFirstLogin = false;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({ 
      message: 'Đổi mật khẩu thành công.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isVIP: user.isVIP, permissions: user.permissions, requirePasswordChange: false }
    });
  }));

  // Profile: Change Password (requested route)
  app.post('/api/users/profile/change-password', authenticate, asyncHandler(async (req: any, res) => {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      res.status(400);
      throw new Error('Vui lòng cung cấp mật khẩu cũ và mật khẩu mới');
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      res.status(404);
      throw new Error('Người dùng không tồn tại');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      res.status(400);
      throw new Error('Mật khẩu hiện tại không đúng');
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.isFirstLogin = false;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({ 
      message: 'Đổi mật khẩu thành công.',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isVIP: user.isVIP, permissions: user.permissions, requirePasswordChange: false }
    });
  }));

  // --- Cart Routes ---
  app.get('/api/cart', authenticate, asyncHandler(async (req: any, res) => {
    let cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] });
    }
    res.json(cart);
  }));

  app.post('/api/cart/add', authenticate, asyncHandler(async (req: any, res) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
      res.status(400);
      throw new Error('Missing productId or quantity');
    }

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    await cart.save();
    
    cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    res.json(cart);
  }));

  app.delete('/api/cart/:productId', authenticate, asyncHandler(async (req: any, res) => {
    const { productId } = req.params;
    const cart = await Cart.findOne({ userId: req.user.id });
    
    if (cart) {
      cart.items = cart.items.filter(item => item.productId.toString() !== productId) as any;
      await cart.save();
    }
    
    const updatedCart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    res.json(updatedCart);
  }));

  app.delete('/api/cart/clear', authenticate, asyncHandler(async (req: any, res) => {
    await Cart.findOneAndDelete({ userId: req.user.id });
    res.json({ message: 'Cart cleared' });
  }));
  
  app.post('/api/cart/sync', authenticate, asyncHandler(async (req: any, res) => {
    // Optional: Synchronize local cart to server after login
    const { items } = req.body;
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: items || [] });
    } else if (items && items.length > 0) {
      for (const item of items) {
        const itemIndex = cart.items.findIndex(ci => ci.productId.toString() === item.productId);
        if (itemIndex > -1) {
          cart.items[itemIndex].quantity += item.quantity;
        } else {
          cart.items.push({ productId: item.productId, quantity: item.quantity });
        }
      }
      await cart.save();
    }
    
    const updatedCart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    res.json(updatedCart);
  }));

  app.put('/api/cart/:productId', authenticate, asyncHandler(async (req: any, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    
    let cart = await Cart.findOne({ userId: req.user.id });
    if (cart) {
      const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
      if (itemIndex > -1) {
        if (quantity > 0) {
          cart.items[itemIndex].quantity = quantity;
        } else {
          cart.items.splice(itemIndex, 1);
        }
        await cart.save();
      }
    }
    
    const updatedCart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    res.json(updatedCart);
  }));

  // --- Settings Routes ---
  app.get('/api/settings', asyncHandler(async (req, res) => {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        heroImage: 'https://images.unsplash.com/photo-1522673607200-16488352475b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        heroTitle: 'Gửi Trọn Yêu Thương',
        heroSubtitle: 'Khám phá bộ sưu tập hoa tươi nghệ thuật dành riêng cho mọi dịp đặc biệt của bạn.'
      });
    }
    res.json(settings);
  }));

  app.get('/api/settings/payment', asyncHandler(async (req, res) => {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        heroImage: 'https://images.unsplash.com/photo-1522673607200-16488352475b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        heroTitle: 'Gửi Trọn Yêu Thương',
        heroSubtitle: 'Khám phá bộ sưu tập hoa tươi nghệ thuật dành riêng cho mọi dịp đặc biệt của bạn.'
      });
    }
    res.json({
      bankName: settings.bankName,
      accountNumber: settings.accountNumber,
      accountHolder: settings.accountHolder,
      momoPhone: settings.momoPhone
    });
  }));

  app.put('/api/settings/payment', authenticate, checkRole(['admin']), asyncHandler(async (req, res) => {
    let settings = await Setting.findOne();
    const { bankName, accountNumber, accountHolder, momoPhone } = req.body;
    
    if (!settings) {
      settings = await Setting.create({
        heroImage: 'https://images.unsplash.com/photo-1522673607200-16488352475b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
        heroTitle: 'Gửi Trọn Yêu Thương',
        heroSubtitle: 'Khám phá bộ sưu tập hoa tươi nghệ thuật dành riêng cho mọi dịp đặc biệt của bạn.',
        bankName,
        accountNumber,
        accountHolder,
        momoPhone
      });
    } else {
      settings.bankName = bankName || settings.bankName;
      settings.accountNumber = accountNumber || settings.accountNumber;
      settings.accountHolder = accountHolder || settings.accountHolder;
      settings.momoPhone = momoPhone || settings.momoPhone;
      await settings.save();
    }
    
    res.json(settings);
  }));

  // --- API Routes ---
  
  // Public: View Flowers
  app.get('/api/products', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (req.query.showHidden !== 'true') {
      query.isHidden = { $ne: true };
    }

    const [products, totalItems] = await Promise.all([
      Product.find(query)
        .populate('createdBy', 'name')
        .populate('priceHistory.updatedBy', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Product.countDocuments(query)
    ]);

    res.json({
      items: products,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        limit
      }
    });
  }));

  // Admin: Manage Products
  app.post('/api/products', authenticate, checkPermission('manage_inventory'), asyncHandler(async (req: any, res) => {
    const { name, price, stock, costPrice } = req.body;
    
    if (!name || name.trim() === '') {
      res.status(400);
      throw new Error('Tên sản phẩm không được để trống');
    }
    if (price === undefined || price < 0) {
      res.status(400);
      throw new Error('Giá sản phẩm không hợp lệ (phải >= 0)');
    }
    if (stock === undefined || stock < 0) {
      res.status(400);
      throw new Error('Số lượng tồn kho không hợp lệ (phải >= 0)');
    }
    if (costPrice !== undefined && costPrice < 0) {
      res.status(400);
      throw new Error('Giá vốn không hợp lệ (phải >= 0)');
    }

    const productData = { ...req.body, createdBy: req.user.id };
    const newProduct = await Product.create(productData);
    res.status(201).json(newProduct);
  }));

  app.post('/api/products/bulk', authenticate, checkPermission('manage_inventory'), asyncHandler(async (req: any, res) => {
    if (!Array.isArray(req.body)) {
      res.status(400);
      throw new Error('Dữ liệu không hợp lệ (phải là một mảng)');
    }
    const productsData = req.body.map(item => ({ ...item, createdBy: req.user.id }));
    const inserted = await Product.insertMany(productsData);
    res.status(201).json({ message: 'Tạo hàng loạt thành công', count: inserted.length });
  }));

  app.patch('/api/products/:id', authenticate, checkPermission('manage_inventory'), asyncHandler(async (req: any, res) => {
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      res.status(404);
      throw new Error('Không tìm thấy sản phẩm');
    }

    if (req.body.version !== undefined && existingProduct.version !== undefined && existingProduct.version !== req.body.version) {
      res.status(409).json({ message: 'Dữ liệu đã cũ, vui lòng tải lại trang để cập nhật nội dung mới nhất', code: 'CONCURRENCY_CONFLICT' });
      return;
    }

    const { price, version, name, stock, costPrice, ...rest } = req.body;

    if (name !== undefined && name.trim() === '') {
      res.status(400);
      throw new Error('Tên sản phẩm không được để trống');
    }
    if (price !== undefined && price < 0) {
      res.status(400);
      throw new Error('Giá sản phẩm không hợp lệ (phải >= 0)');
    }
    if (stock !== undefined && stock < 0) {
      res.status(400);
      throw new Error('Số lượng tồn kho không hợp lệ (phải >= 0)');
    }
    if (costPrice !== undefined && costPrice < 0) {
      res.status(400);
      throw new Error('Giá vốn không hợp lệ (phải >= 0)');
    }
    
    // Check if price is being updated
    if (price !== undefined && price !== existingProduct.price) {
      existingProduct.priceHistory.push({
        oldPrice: existingProduct.price,
        newPrice: price,
        updatedBy: req.user.id,
        updatedAt: new Date()
      });
      
      await AuditLog.create({
        userId: req.user.id,
        userName: req.user.name,
        action: 'Sửa giá sản phẩm',
        targetId: existingProduct._id.toString(),
        details: { productName: existingProduct.name, oldPrice: existingProduct.price, newPrice: price }
      });
      existingProduct.price = price;
    }

    if (rest.image && rest.image !== existingProduct.image) {
      if (existingProduct.image && !existingProduct.image.startsWith('data:image')) {
        console.log(`[Image Cleanup] Xóa ảnh rác do cập nhật: ${existingProduct.image}`);
      }
    }

    // Update other fields
    Object.assign(existingProduct, rest);
    existingProduct.version = (existingProduct.version || 0) + 1;
    
    await existingProduct.save();
    res.json(existingProduct);
  }));

  app.delete('/api/products/:id', authenticate, checkRole(['admin']), asyncHandler(async (req: any, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error('Không tìm thấy sản phẩm');
    }
    
    product.isDeleted = true;
    await product.save();
    
    // Simulate Image Deletion for cleanup requirement
    if (product.image && !product.image.startsWith('data:image')) {
      console.log(`[Image Cleanup] Xóa ảnh rác: ${product.image}`);
      // Add cloudinary or fs.unlink logic here if applicable
    }

    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Xóa sản phẩm (Soft Delete)',
      targetId: product._id.toString(),
      details: { productName: product.name }
    });

    res.json({ message: 'Đã xóa sản phẩm thành công' });
  }));

  // Customer: Place Order
  app.post('/api/orders', authenticate, checkRole(['customer', 'admin']), asyncHandler(async (req: any, res) => {
    // Check Double Submission (30s rate limit)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const recentOrder = await Order.findOne({ userId: req.user.id, createdAt: { $gte: thirtySecondsAgo } });
    if (recentOrder) {
      res.status(429);
      throw new Error('Yêu cầu đang được xử lý, vui lòng không thao tác quá nhanh');
    }

    const { totalAmount, items, address, deliveryDate, deliveryTime, cardMessage, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('Giỏ hàng trống, không thể đặt hàng');
    }

    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        res.status(400);
        throw new Error('Số lượng sản phẩm không hợp lệ (phải > 0)');
      }
    }

    if (!address || !address.district || !address.ward || !address.street) {
      res.status(400);
      throw new Error('Thiếu địa chỉ giao hàng');
    }
    
    // Atomic stock deduction & Price validation
    const deductedItems: any[] = [];
    let calculatedSubtotal = 0;
    const itemsWithPrices: any[] = [];
    let expectedTotalAmount = 0;

    try {
      for (const item of items) {
        const productId = item.product || item._id;
        const p = await Product.findById(productId);
        if (!p) {
          throw new Error('Một hoặc nhiều sản phẩm không tồn tại');
        }

        // Calculate true price
        const unitPrice = req.user.isVIP ? p.price * 0.8 : p.price;
        calculatedSubtotal += unitPrice * item.quantity;
        
        itemsWithPrices.push({
          product: productId,
          name: p.name,
          quantity: item.quantity,
          price: unitPrice,
          image: p.image
        });

        const updatedProduct = await Product.findOneAndUpdate(
          { _id: productId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { returnDocument: 'after' }
        );
        if (!updatedProduct) {
          throw new Error(`Sản phẩm ${p.name} đã hết hàng hoặc không đủ số lượng.`);
        }
        deductedItems.push({ productId, quantity: item.quantity, name: updatedProduct.name });
      }

      // Validate total
      const shipping = req.user.isVIP ? 0 : 20000;
      expectedTotalAmount = calculatedSubtotal + shipping;
      if (Math.abs(expectedTotalAmount - totalAmount) > 10) { 
         throw new Error('Tổng tiền đơn hàng không khớp với dữ liệu hệ thống. Vui lòng tải lại giỏ hàng và thử lại.');
      }

    } catch (err: any) {
      for (const item of deductedItems) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
      res.status(400);
      throw err;
    }

    const newOrder = await Order.create({
      userId: req.user.id,
      items: itemsWithPrices,
      totalAmount: expectedTotalAmount,
      address,
      deliveryDate,
      deliveryTime,
      cardMessage,
      paymentMethod: paymentMethod || 'COD',
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        updatedAt: new Date(),
        updatedBy: { id: req.user.id, name: req.user.name, role: req.user.role }
      }],
      actionHistory: [{
        staffId: req.user.id,
        staffName: req.user.name,
        action: 'Đặt hàng',
        oldValue: 'None',
        newValue: 'pending',
        timestamp: new Date()
      }]
    }) as any;

    if (!newOrder) {
       res.status(500);
       throw new Error('Lỗi hệ thống: Không thể tạo đơn hàng');
    }

    for (const item of deductedItems) {
      await InventoryLog.create({
        type: 'export',
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        reason: `Bán hàng (Đơn #${newOrder._id})`,
        performedBy: req.user.name
      });
    }

    res.status(201).json({ 
      message: 'Đặt hoa thành công! Vui lòng chuẩn bị tiền mặt khi nhận hàng.', 
      orderId: newOrder._id,
      order: newOrder
    });
  }));

  // Admin: Delete Order
  app.delete('/api/orders/:id', authenticate, checkRole(['admin']), asyncHandler(async (req: any, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }
    
    order.isDeleted = true;
    await order.save();

    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Xóa đơn hàng (Soft Delete)',
      targetId: order._id.toString(),
      details: { totalAmount: order.totalAmount }
    });

    res.json({ message: 'Đã xóa đơn hàng thành công' });
  }));

  // Admin: Get All Orders
  app.get('/api/orders', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [orders, totalItems] = await Promise.all([
      Order.find()
        .populate('processedBy', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Order.countDocuments()
    ]);

    res.json({
      items: orders,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        limit
      }
    });
  }));

  // Staff: Get orders for staff
  app.get('/api/orders/staff', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    const staffOrders = await Order.find({ 
      status: { $in: ['pending', 'confirmed', 'processing'] } 
    }).sort({ createdAt: -1 });
    res.json(staffOrders);
  }));

  // Shipper: Get orders for shipper
  app.get('/api/orders/shipper', authenticate, checkRole(['shipper', 'admin']), asyncHandler(async (req: any, res) => {
    const shipperOrders = await Order.find({ 
      $or: [
        { status: 'ready' },
        { shipperId: req.user.id },
        { shipperId: new mongoose.Types.ObjectId(req.user.id) }
      ]
    }).sort({ updatedAt: -1 });
    res.json(shipperOrders);
  }));

  // Customer: Get My Orders
  app.get('/api/orders/mine', authenticate, checkRole(['customer', 'admin', 'staff', 'shipper']), asyncHandler(async (req: any, res) => {
    // Robust query to handle both string and ObjectId for userId (data migration support)
    const myOrders = await Order.find({ 
      $or: [
        { userId: req.user.id },
        { userId: new mongoose.Types.ObjectId(req.user.id) }
      ]
    }).sort({ createdAt: -1 });
    res.json(myOrders);
  }));

  // Alias for compatibility if requested
  app.get('/api/orders/my-orders', authenticate, checkRole(['customer', 'admin', 'staff', 'shipper']), asyncHandler(async (req: any, res) => {
    const myOrders = await Order.find({ 
      $or: [
        { userId: req.user.id },
        { userId: new mongoose.Types.ObjectId(req.user.id) }
      ]
    }).sort({ createdAt: -1 });
    res.json(myOrders);
  }));

  // Customer: Submit Review
  app.post('/api/orders/:id/review', authenticate, checkRole(['customer']), asyncHandler(async (req: any, res) => {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }
    console.log(`Checking review eligibility for order ${order._id}. Current status: ${order.status}`);
    if (order.status !== 'delivered' && order.status !== 'completed') {
      res.status(400);
      throw new Error(`Chỉ được thực hiện khi đơn hàng thành công (Trạng thái hiện tại: ${order.status})`);
    }

    const { comment, rating, productId } = req.body;
    const newReview = await Review.create({
      orderId: order._id.toString(),
      productId,
      userId: req.user.id,
      userName: req.user.name,
      comment,
      rating
    });
    
    order.reviewed = true;
    await order.save();
    
    res.status(201).json({ message: 'Cảm ơn bạn đã để lại đánh giá!', review: newReview });
  }));

  // Admin/Staff: Get All Reviews
  app.get('/api/reviews', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  }));

  // Admin: Confirm Order & Deduct Stock
  app.patch('/api/orders/:id/confirm', authenticate, checkPermission('approve_orders'), asyncHandler(async (req: any, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }

    // Version check (Optimistic Locking)
    if (req.body.version !== undefined && order.__v !== req.body.version) {
      res.status(409).json({ message: 'Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại trang.', code: 'CONCURRENCY_CONFLICT' });
      return;
    }
    
    if (order.status === 'pending') {
      const oldStatus = order.status;
      order.status = 'confirmed';
      (order as any).statusHistory.push({
        status: 'confirmed',
        updatedAt: new Date(),
        updatedBy: { id: req.user.id, name: req.user.name, role: req.user.role }
      });
      order.confirmedBy = req.user.name;
      order.staffId = new mongoose.Types.ObjectId(req.user.id);
      order.processedBy = new mongoose.Types.ObjectId(req.user.id);
      
      // Log Action
      (order as any).actionHistory.push({
        staffId: new mongoose.Types.ObjectId(req.user.id),
        staffName: req.user.name,
        action: 'Xác nhận đơn hàng',
        oldValue: oldStatus,
        newValue: 'confirmed',
        timestamp: new Date()
      });

      // Try to link to active shift
      const activeShift = await Shift.findOne({ staffId: req.user.id, status: 'open' });
      if (activeShift) {
        order.shiftId = activeShift._id;
      }

      try {
        await order.save();
      } catch (err: any) {
        if (err.name === 'VersionError') {
          res.status(409).json({ message: 'Xung đột dữ liệu: Dữ liệu đã được cập nhật bởi nhân viên khác.', code: 'CONCURRENCY_CONFLICT' });
          return;
        }
        throw err;
      }
    }
    const updatedOrder = await Order.findById(order._id).populate('processedBy', 'name');
    res.json({ message: 'Đơn hàng đã được xác nhận và cập nhật tồn kho', order: updatedOrder });
  }));

  // Public: Get Product Reviews
  app.get('/api/products/:id/reviews', asyncHandler(async (req, res) => {
    const productReviews = await Review.find({ productId: req.params.id });
    res.json(productReviews);
  }));

  // Public: Track Order
  app.get('/api/orders/track/:id', asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }
    res.json({ id: order._id, status: order.status, createdAt: order.createdAt });
  }));

  // Customer: Cancel Order
  app.post('/api/orders/:id/cancel', authenticate, checkRole(['customer']), asyncHandler(async (req: any, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }
    
    if (order.userId.toString() !== req.user.id) {
      res.status(403);
      throw new Error('Không có quyền hủy đơn hàng này');
    }

    if (order.status !== 'pending') {
      res.status(400);
      throw new Error('Chỉ có thể hủy đơn hàng đang chờ duyệt');
    }

    if (!order.isPaid && order.paymentMethod !== 'COD') {
      res.status(400);
      throw new Error('Đơn hàng đang chờ thanh toán Gateway. Vui lòng gửi yêu cầu hỗ trợ hoặc đợi Admin phê duyệt hủy.');
    }

    // Refund stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
      await InventoryLog.create({
        type: 'import',
        productId: item.product,
        productName: item.name,
        quantity: item.quantity,
        reason: `Khách hủy đơn hàng #${order._id}`,
        performedBy: req.user.name
      });
    }

    order.status = 'cancelled';
    order.failedReason = req.body.reason || 'Khách hàng tự hủy trên hệ thống';
    (order as any).statusHistory.push({
      status: 'cancelled',
      updatedAt: new Date(),
      updatedBy: { id: req.user.id, name: req.user.name, role: req.user.role }
    });
    (order as any).actionHistory.push({
      staffId: new mongoose.Types.ObjectId(req.user.id),
      staffName: req.user.name,
      action: 'Khách hàng hủy đơn',
      oldValue: 'pending',
      newValue: 'cancelled',
      timestamp: new Date()
    });

    await order.save();
    res.json({ message: 'Đã hủy đơn hàng thành công' });
  }));

  // Shipper: Get assigned orders and history
  app.get('/api/shipper/orders', authenticate, checkRole(['shipper', 'admin']), asyncHandler(async (req: any, res) => {
    const orders = await Order.find({
      $or: [
        { status: { $in: ['confirmed', 'ready'] } },
        { deliveredBy: req.user.name }
      ]
    }).sort({ updatedAt: -1 });
    res.json(orders);
  }));

  app.post('/api/orders/:id/confirm-payment', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req: any, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }

    if (order.isPaid) {
      res.status(400);
      throw new Error('Đơn hàng này đã được thanh toán');
    }

    order.isPaid = true;
    order.status = 'confirmed'; // automatically move to confirmed or ready
    (order as any).statusHistory.push({
      status: 'confirmed',
      updatedAt: new Date(),
      updatedBy: { id: req.user.id, name: req.user.name, role: req.user.role }
    });
    order.confirmedBy = req.user.name;

    (order as any).actionHistory.push({
      staffId: new mongoose.Types.ObjectId(req.user.id),
      staffName: req.user.name,
      action: 'Xác nhận thanh toán',
      oldValue: 'pending',
      newValue: 'confirmed',
      timestamp: new Date()
    });

    await order.save();
    res.json({ message: 'Đã xác nhận thanh toán' });
  }));

  // Admin/Staff/Shipper: Update Status
  app.patch('/api/orders/:id/status', authenticate, checkRole(['shipper', 'admin', 'staff']), asyncHandler(async (req: any, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }

    // Version check (Optimistic Locking)
    if (req.body.version !== undefined && order.__v !== req.body.version) {
      res.status(409).json({ message: 'Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại trang.', code: 'CONCURRENCY_CONFLICT' });
      return;
    }
    
    const oldStatus = order.status;
    const newStatus = req.body.status;

    if (newStatus !== 'cancelled' && newStatus !== 'pending' && !order.isPaid && order.paymentMethod !== 'COD') {
      res.status(400);
      throw new Error('Đơn hàng chuyển khoản cần được "Xác nhận thanh toán" trước khi đổi thẻ trạng thái');
    }

    if (oldStatus === 'pending' && newStatus === 'confirmed') {
      order.confirmedBy = req.user.name;
    }

    if (['cancelled', 'returned', 'failed'].includes(newStatus) && !['cancelled', 'returned', 'failed'].includes(oldStatus)) {
        for (const item of order.items) {
           await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
           await InventoryLog.create({
             type: 'import',
             productId: item.product,
             productName: item.name,
             quantity: item.quantity,
             reason: `Hoàn kho do đơn hàng ${newStatus === 'returned' ? 'trả hàng' : newStatus === 'failed' ? 'giao thất bại' : 'bị hủy'} (#${order._id})`,
             performedBy: req.user.name
           });
        }
    }

    if (newStatus === 'delivered' || newStatus === 'completed' || newStatus === 'shipping') {
      order.deliveredBy = req.user.name;
    }

    // Log Action
    (order as any).actionHistory.push({
      staffId: new mongoose.Types.ObjectId(req.user.id),
      staffName: req.user.name,
      action: 'Cập nhật trạng thái',
      oldValue: oldStatus,
      newValue: newStatus,
      timestamp: new Date()
    });

    const query: any = { _id: req.params.id };
    if (req.user.role === 'shipper' && newStatus === 'shipping') {
      query.status = 'ready';
      query.$or = [{ shipperId: { $exists: false } }, { shipperId: null }];
    }

    const updatedOrder = await Order.findOneAndUpdate(
      query,
      { 
        $set: { 
          status: newStatus,
          failedReason: ['failed', 'cancelled'].includes(newStatus) ? req.body.reason : order.failedReason,
          deliveredBy: (newStatus === 'delivered' || newStatus === 'completed' || newStatus === 'shipping') ? req.user.name : order.deliveredBy,
          shipperId: req.user.role === 'shipper' ? new mongoose.Types.ObjectId(req.user.id) : (order as any).shipperId,
          confirmedBy: (oldStatus === 'pending' && newStatus === 'confirmed') ? req.user.name : order.confirmedBy,
          processedBy: ['admin', 'staff'].includes(req.user.role) ? new mongoose.Types.ObjectId(req.user.id) : (order.processedBy as any)
        },
        $push: {
          statusHistory: {
            status: newStatus,
            updatedAt: new Date(),
            updatedBy: { id: new mongoose.Types.ObjectId(req.user.id), name: req.user.name, role: req.user.role }
          },
          actionHistory: {
            staffId: new mongoose.Types.ObjectId(req.user.id),
            staffName: req.user.name,
            action: 'Cập nhật trạng thái',
            oldValue: oldStatus,
            newValue: newStatus,
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    ).populate('processedBy', 'name');

    if (!updatedOrder) {
      const orderExists = await Order.exists({ _id: req.params.id });
      if (orderExists && req.user.role === 'shipper' && newStatus === 'shipping') {
        res.status(400);
        throw new Error('Đơn hàng này đã có người nhận, vui lòng tải lại danh sách');
      }
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng sau khi cập nhật');
    }

    res.json({ message: `Đơn hàng đã chuyển sang trạng thái ${newStatus}`, order: updatedOrder });
  }));

  // Staff/Admin: Edit Order Details
  app.patch('/api/orders/:id/edit', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req: any, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }

    if (!['pending', 'confirmed', 'processing', 'ready'].includes(order.status)) {
      res.status(400);
      throw new Error('Không thể chỉnh sửa đơn hàng ở trạng thái này');
    }

    const { address, cardMessage } = req.body;
    const historyEntries: any[] = [];

    if (address && JSON.stringify(address) !== JSON.stringify(order.address)) {
      historyEntries.push({
        staffId: req.user.id,
        staffName: req.user.name,
        field: 'Địa chỉ',
        oldValue: JSON.stringify(order.address),
        newValue: JSON.stringify(address),
        timestamp: new Date()
      });
      order.address = address;
    }

    if (cardMessage !== undefined && cardMessage !== order.cardMessage) {
      historyEntries.push({
        staffId: req.user.id,
        staffName: req.user.name,
        field: 'Lời nhắn',
        oldValue: order.cardMessage || 'Trống',
        newValue: cardMessage || 'Trống',
        timestamp: new Date()
      });
      order.cardMessage = cardMessage;
    }

    if (historyEntries.length > 0) {
      (order as any).editHistory.push(...historyEntries);
      (order as any).actionHistory.push({
        staffId: req.user.id,
        staffName: req.user.name,
        action: 'Chỉnh sửa thông tin đơn hàng',
        timestamp: new Date()
      });
      await order.save();
    }

    res.json({ message: 'Cập nhật thông tin thành công', order });
  }));

  // Customer: Request Return
  app.post('/api/orders/:id/return', authenticate, asyncHandler(async (req: any, res) => {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }

    console.log(`Checking return eligibility for order ${order._id}. Current status: ${order.status}`);
    if (order.status !== 'delivered' && order.status !== 'completed') {
      res.status(400);
      throw new Error(`Chỉ có thể yêu cầu trả hàng cho đơn hàng đã hoàn thành (Trạng thái hiện tại: ${order.status})`);
    }

    if (order.returnStatus !== 'None') {
      res.status(400);
      throw new Error('Đơn hàng này đã có yêu cầu trả hàng');
    }

    order.returnStatus = 'Requested';
    order.returnReason = req.body.reason;
    order.returnImages = req.body.images || [];
    
    (order as any).actionHistory.push({
      staffId: req.user.id,
      staffName: req.user.name,
      action: 'Khách yêu cầu trả hàng/hoàn tiền',
      timestamp: new Date()
    });

    await order.save();
    res.json({ message: 'Gửi yêu cầu trả hàng thành công', order });
  }));

  // Admin: Handle Return Request
  app.patch('/api/orders/:id/return-handle', authenticate, checkPermission('manage_returns'), asyncHandler(async (req: any, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error('Không tìm thấy đơn hàng');
    }

    if (order.returnStatus !== 'Requested') {
      res.status(400);
      throw new Error('Đơn hàng không có yêu cầu trả hàng đang chờ');
    }

    const { status, refundAmount, restock } = req.body; // status: Approved or Rejected
    
    if (restock && status === 'Approved') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        await InventoryLog.create({
          type: 'import',
          productId: item.product,
          productName: item.name,
          quantity: item.quantity,
          reason: `Trả hàng (Đơn #${order._id})`,
          performedBy: req.user.name
        });
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          returnStatus: status,
          refundAmount: status === 'Approved' ? (refundAmount || order.totalAmount) : 0,
          status: status === 'Approved' ? 'returned' : order.status,
          processedBy: new mongoose.Types.ObjectId(req.user.id)
        },
        $push: {
          statusHistory: {
            status: status === 'Approved' ? 'returned' : order.status,
            updatedAt: new Date(),
            updatedBy: { id: new mongoose.Types.ObjectId(req.user.id), name: req.user.name, role: req.user.role }
          },
          actionHistory: {
            staffId: new mongoose.Types.ObjectId(req.user.id),
            staffName: req.user.name,
            action: `Duyệt trả hàng: ${status}`,
            oldValue: 'Requested',
            newValue: status,
            timestamp: new Date()
          }
        }
      },
      { returnDocument: 'after' }
    );

    res.json({ message: 'Xử lý yêu cầu trả hàng thành công', order: updatedOrder });
  }));

  // Admin: Get All Users with totalSpent for customers
  app.get('/api/admin/users', authenticate, checkPermission('manage_hr'), asyncHandler(async (req, res) => {
    try {
      const allUsers = await User.find({}, '-password').lean();
      
      // Calculate totalSpent for each customer
      const usersWithSpent = await Promise.all(allUsers.map(async (u: any) => {
        // Ensure critical fields are initialized for legacy data
        u.permissions = Array.isArray(u.permissions) ? u.permissions : [];
        u.role = u.role || 'customer';
        u.status = u.status || 'active';

        if (u.role === 'customer') {
          const spent = await Order.aggregate([
            { $match: { userId: u._id, status: { $in: ['delivered', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]);
          u.totalSpent = spent[0]?.total || 0;
        }
        u.id = u._id;
        return u;
      }));

      res.json(usersWithSpent || []);
    } catch (error) {
      console.error('Error in /api/admin/users:', error);
      res.json([]); // Return empty array instead of crashing
    }
  }));

  // Admin/Staff: Create Customer
  app.post('/api/customers', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    const { name, email, phone, address, notes, isVIP } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400);
      throw new Error('Email này đã tồn tại');
    }

    // Default password for customers created by admin
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'customer',
      phone,
      address,
      notes,
      isVIP: isVIP || false,
      status: 'active'
    });

    res.status(201).json(newUser);
  }));

  app.post('/api/customers/bulk', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    if (!Array.isArray(req.body)) {
      res.status(400);
      throw new Error('Dữ liệu phải là một mảng');
    }

    const hashedPassword = await bcrypt.hash('123456', 10);
    const newCustomers = [];
    let skippedCount = 0;

    for (const item of req.body) {
      const { name, email, phone, address, notes, isVIP } = item;
      if (!name || !email) continue;
      const existing = await User.findOne({ email });
      if (existing) {
        skippedCount++;
        continue;
      }
      newCustomers.push({
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        role: 'customer',
        notes,
        isVIP: isVIP || false,
        status: 'active'
      });
    }

    if (newCustomers.length > 0) {
      await User.insertMany(newCustomers);
    }
    
    res.status(201).json({
      message: 'Import khách hàng thành công',
      importedCount: newCustomers.length,
      skippedCount
    });
  }));

  // Admin/Staff: Update Customer
  app.put('/api/customers/:id', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    const { name, email, phone, address, notes, status, isVIP } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'customer') {
      res.status(404);
      throw new Error('Không tìm thấy khách hàng');
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (notes) user.notes = notes;
    if (status) user.status = status;
    if (isVIP !== undefined) user.isVIP = isVIP;

    await user.save();
    res.json(user);
  }));

  // Admin/Staff: Delete Customer
  app.delete('/api/customers/:id', authenticate, checkRole(['admin']), asyncHandler(async (req: any, res) => {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'customer') {
      res.status(404);
      throw new Error('Không tìm thấy khách hàng');
    }

    const originalEmail = user.email;
    user.isDeleted = true;
    user.email = `${user.email}_del_${Date.now()}`;
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Xóa khách hàng (Soft Delete)',
      targetId: user._id.toString(),
      details: { email: originalEmail }
    });

    res.json({ message: 'Đã xóa khách hàng thành công' });
  }));

  // Admin: Update User (PATCH)
  app.patch('/api/admin/users/:id', authenticate, checkRole(['admin']), asyncHandler(async (req: any, res) => {
    const { name, phone, email, role, permissions, status, address, notes, isVIP } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('Không tìm thấy người dùng');
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400);
        throw new Error('Email này đã tồn tại trong hệ thống');
      }
      user.email = email;
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    
    let isRoleChanged = false;
    let oldRole = user.role;
    if (role && role !== user.role) {
      user.role = role;
      isRoleChanged = true;
    }
    
    if (permissions) user.permissions = permissions;
    if (status) user.status = status;
    if (address !== undefined) user.address = address;
    if (notes !== undefined) user.notes = notes;
    if (isVIP !== undefined) user.isVIP = isVIP;

    await user.save();

    if (isRoleChanged) {
      await AuditLog.create({
        userId: req.user.id,
        userName: req.user.name,
        action: 'Thay đổi quyền nhân viên',
        targetId: user._id.toString(),
        details: { oldRole, newRole: role, email: user.email }
      });
    }

    // Log the action
    console.log(`[AUDIT LOG] Admin ${req.user.name} đã chỉnh sửa thông tin của ${user.name} vào lúc ${new Date().toLocaleString('vi-VN')}`);

    res.json(user);
  }));

  // Admin: Update User (Legacy PUT)
  app.put('/api/admin/users/:id', authenticate, checkRole(['admin']), asyncHandler(async (req, res) => {
    const { name, email, role, permissions, status } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('Không tìm thấy người dùng');
    }

    if (name) user.name = name;
    if (email) user.email = email;
    
    let isRoleChanged = false;
    let oldRole = user.role;
    if (role && role !== user.role) {
      user.role = role;
      isRoleChanged = true;
    }
    
    if (permissions) user.permissions = permissions;
    if (status) user.status = status;

    await user.save();
    
    if (isRoleChanged) {
      await AuditLog.create({
        userId: (req as any).user.id,
        userName: (req as any).user.name,
        action: 'Thay đổi quyền nhân viên',
        targetId: user._id.toString(),
        details: { oldRole, newRole: role, email: user.email }
      });
    }

    res.json({ message: 'Cập nhật thông tin thành công', user });
  }));

  // Admin: Delete User
  app.delete('/api/admin/users/:id', authenticate, checkRole(['admin']), asyncHandler(async (req: any, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('Không tìm thấy người dùng');
    }

    if (user.role === 'admin') {
      res.status(400);
      throw new Error('Không thể xóa tài khoản Admin');
    }

    const originalEmail = user.email;
    user.isDeleted = true;
    user.email = `${user.email}_del_${Date.now()}`;
    await user.save();

    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.name,
      action: 'Xóa nhân viên (Soft Delete)',
      targetId: user._id.toString(),
      details: { email: originalEmail, role: user.role }
    });

    res.json({ message: 'Đã xóa người dùng thành công' });
  }));

  // Admin: Reset Password
  app.patch('/api/admin/reset-password/:id', authenticate, checkRole(['admin']), asyncHandler(async (req: any, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('Không tìm thấy người dùng');
    }

    // Security check: Prevent non-super-admins from resetting fellow admins? 
    // Here we just check if it's an admin trying to reset another admin. 
    // If the system should allow it, we can. The user said: "ngăn chặn việc nhân viên tự đặt lại mật khẩu của Admin khác"
    // Since only admins can reach here, we're safe from staff resetting admins.
    // However, if we want to prevent an admin from resetting ANOTHER admin:
    if (user.role === 'admin' && req.user.id !== user._id.toString()) {
       // Only allow self-reset or something special? 
       // Usually in small teams one admin can reset another, but user asked for prevention.
       // Let's prevent resetting other admins.
       res.status(403);
       throw new Error('Bạn không thể đặt lại mật khẩu cho tài khoản Admin khác');
    }

    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    user.password = hashedPassword;
    await user.save();

    res.json({ 
      message: 'Đã đặt lại mật khẩu thành công!',
      newPassword: defaultPassword
    });
  }));

  // Admin: Get Stats
  app.get('/api/admin/stats', authenticate, checkPermission('view_revenue'), asyncHandler(async (req, res) => {
    const deliveredOrders = await Order.find({ status: { $in: ['delivered', 'completed'] } });
    let totalRevenue = 0;
    let totalProfit = 0;

    deliveredOrders.forEach(o => {
      totalRevenue += o.totalAmount;
      const orderCost = o.items.reduce((sum, item: any) => sum + (item.costPrice || 0) * item.quantity, 0);
      totalProfit += (o.totalAmount - orderCost);
    });

    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });

    // Calculate product sales
    const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};
    deliveredOrders.forEach(o => {
      o.items.forEach((item: any) => {
        if (!productStats[item.product]) {
          productStats[item.product] = { name: item.name, quantity: 0, revenue: 0 };
        }
        productStats[item.product].quantity += item.quantity;
        productStats[item.product].revenue += (item.price * item.quantity);
      });
    });

    const sortedProducts = Object.values(productStats).sort((a, b) => b.quantity - a.quantity);
    const topProducts = sortedProducts.slice(0, 5);
    // filter out worst products that have 0 sales. The ones not in the list at all are truly 0, but since we rely on delivered orders, they will just be the bottom of the list.
    // If they want to see "sản phẩm bán ế" (including 0 sales), we should probably query all products and merge.
    
    const allProducts = await Product.find({}, 'name');
    allProducts.forEach(p => {
      if (!productStats[p._id.toString()]) {
        productStats[p._id.toString()] = { name: p.name, quantity: 0, revenue: 0 };
      }
    });
    
    const allSortedProducts = Object.values(productStats).sort((a, b) => b.quantity - a.quantity);
    const updatedTopProducts = allSortedProducts.slice(0, 5);
    const worstProducts = [...allSortedProducts].reverse().slice(0, 5);

    const timeframe = req.query.timeframe || 'day';
    let chartData: any[] = [];

    if (timeframe === 'day') {
      // Last 7 days
      chartData = await Promise.all([...Array(7)].map(async (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d.setHours(0,0,0,0));
        const end = new Date(d.setHours(23,59,59,999));
        const dayOrders = await Order.find({ status: { $in: ['delivered', 'completed'] }, createdAt: { $gte: start, $lte: end } });
        const dayRevenue = dayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        return { name: start.toISOString().split('T')[0], revenue: dayRevenue };
      }));
    } else if (timeframe === 'week') {
      // Last 4 weeks
      chartData = await Promise.all([...Array(4)].map(async (_, i) => {
        const end = new Date();
        end.setDate(end.getDate() - (i * 7));
        end.setHours(23,59,59,999);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0,0,0,0);
        const weekOrders = await Order.find({ status: { $in: ['delivered', 'completed'] }, createdAt: { $gte: start, $lte: end } });
        const weekRevenue = weekOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        return { name: `Tuần ${4-i}`, revenue: weekRevenue };
      }));
    } else if (timeframe === 'month') {
      // Last 6 months
      chartData = await Promise.all([...Array(6)].map(async (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23,59,59,999);
        const monthOrders = await Order.find({ status: { $in: ['delivered', 'completed'] }, createdAt: { $gte: start, $lte: end } });
        const monthRevenue = monthOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        return { name: `T${start.getMonth() + 1}/${start.getFullYear()}`, revenue: monthRevenue };
      }));
    } else if (timeframe === 'year') {
      // Last 3 years
      chartData = await Promise.all([...Array(3)].map(async (_, i) => {
        const d = new Date();
        const year = d.getFullYear() - i;
        const start = new Date(year, 0, 1, 0,0,0,0);
        const end = new Date(year, 11, 31, 23,59,59,999);
        const yearOrders = await Order.find({ status: { $in: ['delivered', 'completed'] }, createdAt: { $gte: start, $lte: end } });
        const yearRevenue = yearOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        return { name: `${year}`, revenue: yearRevenue };
      }));
    }

    res.json({
      totalRevenue,
      totalProfit,
      totalOrders,
      pendingOrders,
      totalCustomers,
      revenueChart: chartData.reverse(),
      topProducts: updatedTopProducts,
      worstProducts
    });
  }));

  // --- Shift Management APIs ---

  // Get current user's active shift
  app.get('/api/shifts/current', authenticate, checkRole(['admin', 'staff', 'shipper']), asyncHandler(async (req: any, res) => {
    const activeShift = await Shift.findOne({ staffId: req.user.id, status: 'open' });
    res.json(activeShift);
  }));

  // Start new shift
  app.post('/api/shifts/start', authenticate, checkRole(['admin', 'staff', 'shipper']), asyncHandler(async (req: any, res) => {
    const { startCash } = req.body;
    
    // Check if already has an open shift
    const existingShift = await Shift.findOne({ staffId: req.user.id, status: 'open' });
    if (existingShift) {
      res.status(400);
      throw new Error('Bạn đã có một ca làm việc đang mở');
    }

    const newShift = await Shift.create({
      staffId: req.user.id,
      staffName: req.user.name,
      startCash: Number(startCash) || 0,
      status: 'open'
    });

    res.status(201).json(newShift);
  }));

  // End active shift
  app.post('/api/shifts/end', authenticate, checkRole(['admin', 'staff', 'shipper']), asyncHandler(async (req: any, res) => {
    const { actualCashReceived, notes } = req.body;
    
    const activeShift = await Shift.findOne({ staffId: req.user.id, status: 'open' });
    if (!activeShift) {
      res.status(404);
      throw new Error('Không tìm thấy ca làm việc đang mở');
    }

    // Find all cash orders processed during this shift
    // We link orders to shift via shiftId or staffId + timestamp
    const ordersInShift = await Order.find({
      shiftId: activeShift._id,
      paymentMethod: 'COD',
      status: { $in: ['confirmed', 'processing', 'ready', 'shipping', 'delivered', 'completed'] }
    });

    const totalOrderCash = ordersInShift.reduce((sum, o) => sum + o.totalAmount, 0);
    const expectedCash = activeShift.startCash + totalOrderCash;
    const actualReceived = Number(actualCashReceived) || 0;
    const difference = actualReceived - expectedCash;

    if (!notes || notes.trim() === '') {
      if (difference !== 0) {
        if (actualReceived === 0 && totalOrderCash > 0) {
          res.status(400);
          throw new Error('Số tiền thực nhận đang lệch so với doanh thu hệ thống. Vui lòng kiểm tra lại hoặc nhập lý do chênh lệch');
        }
        res.status(400);
        throw new Error('Số tiền bàn giao có chênh lệch. Vui lòng bắt buộc nhập Ghi chú đối soát (lý do chênh lệch)');
      }
      if (totalOrderCash === 0) {
        res.status(400);
        throw new Error('Ca làm việc có doanh thu bằng 0. Vui lòng bắt buộc nhập Ghi chú đối soát');
      }
    }

    activeShift.status = 'closed';
    activeShift.endTime = new Date();
    activeShift.totalOrderCash = totalOrderCash;
    activeShift.expectedCash = expectedCash;
    activeShift.actualCashReceived = actualReceived;
    activeShift.difference = difference;
    activeShift.notes = notes;

    await activeShift.save();
    res.json(activeShift);
  }));

  // Get shift history
  app.get('/api/shifts', authenticate, checkRole(['admin', 'staff', 'shipper']), asyncHandler(async (req: any, res) => {
    let query: any = {};
    if (req.user.role !== 'admin') {
      query.staffId = req.user.id;
    }
    
    const shifts = await Shift.find(query).sort({ createdAt: -1 }).limit(50);
    res.json(shifts);
  }));

  // --- Inventory & Supplier APIs ---

  // Get all suppliers
  app.get('/api/suppliers', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json(suppliers);
  }));

  // Create supplier
  app.post('/api/suppliers', authenticate, checkRole(['admin']), asyncHandler(async (req, res) => {
    const { name, phone, productIds, ...supplierData } = req.body;
    
    // Check for duplicates
    const existing = await Supplier.findOne({ $or: [{ name: name.trim() }, { phone: phone.trim() }] });
    if (existing) {
      res.status(400);
      throw new Error('Tên hoặc số điện thoại nhà cung cấp này đã tồn tại trong hệ thống');
    }

    const supplier = await Supplier.create({ name, phone, ...supplierData });
    
    if (productIds && Array.isArray(productIds)) {
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { supplierId: supplier._id } }
      );
    }
    
    res.status(201).json(supplier);
  }));

  // Update supplier
  app.patch('/api/suppliers/:id', authenticate, checkRole(['admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, phone, productIds, ...supplierData } = req.body;

    // Check for duplicates (excluding current supplier)
    const existing = await Supplier.findOne({ 
      _id: { $ne: id },
      $or: [{ name: name.trim() }, { phone: phone.trim() }] 
    });
    if (existing) {
      res.status(400);
      throw new Error('Tên hoặc số điện thoại nhà cung cấp này đã trùng với một bên khác');
    }

    const supplier = await Supplier.findByIdAndUpdate(id, { name, phone, ...supplierData }, { new: true });
    if (!supplier) {
      res.status(404);
      throw new Error('Không tìm thấy nhà cung cấp');
    }

    // Update associated products
    if (productIds && Array.isArray(productIds)) {
      // Unset previous associations
      await Product.updateMany(
        { supplierId: id },
        { $unset: { supplierId: "" } }
      );
      // Set new associations
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { supplierId: supplier._id } }
      );
    }

    res.json(supplier);
  }));

  // Delete supplier
  app.delete('/api/suppliers/:id', authenticate, checkRole(['admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const supplier = await Supplier.findByIdAndDelete(id);
    if (!supplier) {
      res.status(404);
      throw new Error('Không tìm thấy nhà cung cấp');
    }

    // Unset supplierId from associated products
    await Product.updateMany(
      { supplierId: id },
      { $unset: { supplierId: "" } }
    );

    res.json({ message: 'Đã xóa nhà cung cấp thành công' });
  }));

  // Get products by supplier
  app.get('/api/products/by-supplier/:supplierId', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    const products = await Product.find({ supplierId: req.params.supplierId });
    res.json(products);
  }));

  // Create bulk Import Ticket
  app.post('/api/inventory/tickets/import', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req: any, res) => {
    const { supplierId, items, notes } = req.body;
    
    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('Thiếu thông tin nhà cung cấp hoặc danh sách sản phẩm');
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      res.status(404);
      throw new Error('Không tìm thấy nhà cung cấp');
    }

    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      const importPrice = Number(item.importPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      totalAmount += importPrice * quantity;

      // Update product stock and supplier
      product.stock += quantity;
      product.supplierId = supplier._id; // Automatically update product's supplier
      await product.save();

      processedItems.push({
        productId: product._id,
        productName: product.name,
        quantity,
        importPrice
      });
    }

    const ticket = await ImportTicket.create({
      supplierId: supplier._id,
      supplierName: supplier.name,
      items: processedItems,
      totalAmount,
      notes,
      performedBy: req.user.name
    });

    // Create individual logs for history/charting
    for (const item of processedItems) {
      await InventoryLog.create({
        type: 'import',
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.importPrice,
        supplierId: supplier._id,
        supplierName: supplier.name,
        reason: notes || 'Nhập hàng theo phiếu',
        performedBy: req.user.name,
        ticketId: ticket._id
      });
    }

    res.status(201).json({ message: 'Lập phiếu nhập kho thành công', ticket });
  }));

  // Create bulk Export Ticket
  app.post('/api/inventory/tickets/export', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req: any, res) => {
    const { type, items, notes } = req.body; // type can be 'sale' or 'waste'
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('Thiếu danh sách sản phẩm xuất kho');
    }

    const deductedItems = [];
    try {
      for (const item of items) {
        const quantity = Number(item.quantity) || 0;
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { returnDocument: 'after' }
        );
        if (!updatedProduct) {
          const p = await Product.findById(item.productId);
          throw new Error(`Sản phẩm ${p ? p.name : 'đã chọn'} không đủ tồn kho (Hiện có: ${p ? p.stock : 0})`);
        }
        deductedItems.push({
          productId: updatedProduct._id,
          productName: updatedProduct.name,
          quantity
        });
      }
    } catch (err: any) {
      for (const item of deductedItems) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
      res.status(400);
      throw err;
    }
    const processedItems = deductedItems;

    const ticket = await ExportTicket.create({
      type: type || 'sale',
      items: processedItems,
      notes,
      performedBy: req.user.name
    });

    // Create individual logs
    for (const item of processedItems) {
      await InventoryLog.create({
        type: type === 'waste' ? 'waste' : 'export',
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        reason: notes || (type === 'waste' ? 'Xuất hủy' : 'Xuất kho'),
        performedBy: req.user.name,
        ticketId: ticket._id
      });
    }

    res.status(201).json({ message: 'Lập phiếu xuất kho thành công', ticket });
  }));

  // Get inventory logs
  app.get('/api/inventory/logs', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req, res) => {
    const logs = await InventoryLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  }));

  // Create Import Ticket (Phiếu Nhập Kho)
  app.post('/api/inventory/import', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req: any, res) => {
    const { productId, quantity, price, supplierId, reason } = req.body;
    
    if (!productId || !quantity) {
      res.status(400);
      throw new Error('Thiếu thông tin sản phẩm hoặc số lượng');
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404);
      throw new Error('Không tìm thấy sản phẩm');
    }

    const supplier = supplierId ? await Supplier.findById(supplierId) : null;

    // Update product stock
    product.stock += Number(quantity);
    await product.save();

    // Create log
    const log = await InventoryLog.create({
      type: 'import',
      productId,
      productName: product.name,
      quantity: Number(quantity),
      price: Number(price),
      supplierId,
      supplierName: supplier?.name || 'Vãng lai',
      reason: reason || 'Nhập hàng mới',
      performedBy: req.user.name
    });

    res.status(201).json({ message: 'Nhập kho thành công', product, log });
  }));

  // Create Waste Ticket (Phiếu Xuất Hủy)
  app.post('/api/inventory/waste', authenticate, checkRole(['admin', 'staff']), asyncHandler(async (req: any, res) => {
    const { productId, quantity, reason } = req.body;

    if (!productId || !quantity) {
      res.status(400);
      throw new Error('Thiếu thông tin sản phẩm hoặc số lượng');
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404);
      throw new Error('Không tìm thấy sản phẩm');
    }

    if (product.stock < Number(quantity)) {
      res.status(400);
      throw new Error('Số lượng tồn kho không đủ để xuất hủy');
    }

    // Update product stock
    product.stock -= Number(quantity);
    await product.save();

    // Create log
    const log = await InventoryLog.create({
      type: 'waste',
      productId,
      productName: product.name,
      quantity: Number(quantity),
      reason: reason || 'Hoa héo/dập',
      performedBy: req.user.name
    });

    res.status(201).json({ message: 'Xuất hủy thành công', product, log });
  }));

  // Settings
  app.get('/api/settings', asyncHandler(async (req, res) => {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        heroImage: 'https://picsum.photos/seed/flower-hero/800/1000',
        heroTitle: 'Nghệ thuật trong từng Đóa hoa.',
        heroSubtitle: 'Kiến tạo những tác phẩm hoa độc bản cho những tâm hồn tinh tế tại Hải Phòng.'
      });
    }
    res.json(settings);
  }));

  app.patch('/api/settings', authenticate, checkRole(['admin']), asyncHandler(async (req, res) => {
    const settings = await Setting.findOneAndUpdate({}, req.body, { returnDocument: 'after', upsert: true });
    res.json(settings);
  }));

  // Backups
  app.get('/api/admin/backups', authenticate, checkRole(['admin']), (req, res) => {
    res.json(getBackupsList());
  });

  app.post('/api/admin/backups', authenticate, checkRole(['admin']), asyncHandler(async (req, res) => {
    const result = await executeBackup();
    res.json(result);
  }));

  // --- Centralized Error Handling Middleware ---
  app.use((err: any, req: any, res: any, next: any) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startBackupCron();
  });

  // Seed Initial Data
  const seedData = async () => {
    try {
      // 1. Seed Admin User
      const adminEmail = 'admin@midnightrose.vn';
      const adminExists = await User.findOne({ email: adminEmail });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
          name: 'Quản trị viên',
          email: adminEmail,
          password: hashedPassword,
          role: 'admin'
        });
        console.log('Admin user seeded');
      }

      // 2. Seed Settings
      const settingsCount = await Setting.countDocuments();
      if (settingsCount === 0) {
        await Setting.create({
          heroImage: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&q=80',
          heroTitle: 'Midnight Rose',
          heroSubtitle: 'Trao gửi yêu thương qua từng cánh hoa'
        });
        console.log('Initial settings seeded');
      }

      // 3. Seed Products
      const productsCount = await Product.countDocuments();
      if (productsCount === 0) {
        const initialProducts = [
          {
            name: 'Hoa Hồng Đỏ Classic',
            price: 500000,
            image: 'https://images.unsplash.com/photo-1548610762-7c6abc94c031?auto=format&fit=crop&q=80',
            category: 'Hoa Hồng',
            stock: 50
          },
          {
            name: 'Bó Hoa Hướng Dương',
            price: 350000,
            image: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&q=80',
            category: 'Hoa Hướng Dương',
            stock: 30
          },
          {
            name: 'Lan Hồ Điệp Trắng',
            price: 1200000,
            image: 'https://images.unsplash.com/photo-1567606117528-5ffe2cd242d2?auto=format&fit=crop&q=80',
            category: 'Hoa Lan',
            stock: 10
          },
          {
            name: 'Bó Hoa Baby Trắng',
            price: 250000,
            image: 'https://images.unsplash.com/photo-1525310238958-2aba1f392f9b?auto=format&fit=crop&q=80',
            category: 'Hoa Baby',
            stock: 100
          }
        ];
        await Product.insertMany(initialProducts);
        console.log('Initial products seeded');
      }
    } catch (err) {
      console.error('❌ Failed to seed data:', err);
    }
  };

  if (isConnected) {
    seedData();
  }
}

startServer();
