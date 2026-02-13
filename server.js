import { createServer } from 'http';
import { Server } from 'socket.io';
import { verifyToken } from './src/utils/jwt.js';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import connectDB from './src/config/database.js';

dotenv.config();

const app = express();

// Middleware
// 1. DYNAMIC CORS SETUP (Local aur Deployed Netlify dono ke liye)
const allowedOrigins = [
  'http://localhost:3000',                                    // Local development
  'https://6980e96a90579a4b376914ad--joyful-panda-706784.netlify.app',  // Tera current Netlify deploy preview
  // Agar custom domain hai future me, yaha add kar: 'https://amulyarestaurant.com'
  'https://hotel-resturant-mangement-system-fr.vercel.app',
  // Ya agar Netlify main domain: 'https://joyful-panda-706784.netlify.app'
  /^https:\/\/.*\.netlify\.app$/,
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],  // All needed methods
    credentials: true,  // Cookies/auth headers allow karne ke liye
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Connect to Database
connectDB();

// Health Check Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Amulya Resturant API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Import Routes
import authRoutes from './src/modules/auth/routes/auth.routes.js';
import hotelRoutes from './src/modules/hotels/routes/hotel.routes.js';
import userRoutes from './src/modules/users/routes/user.routes.js';
import roomRoutes from './src/modules/rooms/routes/room.routes.js';
import bookingRoutes from './src/modules/rooms/routes/booking.routes.js';
import posRoutes from './src/modules/pos/routes/pos.routes.js';
import inventoryRoutes from './src/modules/inventory/routes/inventory.routes.js';
import billingRoutes from './src/modules/billing/routes/billing.routes.js';
import reportsRoutes from './src/modules/reports/routes/reports.routes.js';
import tableRoutes from './src/modules/tables/routes/table.routes.js';
import superAdminRoutes from './src/modules/super-admin/routes/superadmin.routes.js';

// ✅ NEW: Import Public Routes (No Authentication Required)
import publicRoutes from './src/modules/pos/routes/public.routes.js';
import gstReportsRoutes from './src/modules/reports/routes/gstReports.routes.js';

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/super-admin', superAdminRoutes);

// ✅ NEW: Mount Public Routes (No Auth - For Public Menu & Orders)
app.use('/api/public', publicRoutes);
app.use('/api/reports/gst', gstReportsRoutes); 
// Add this in your backend server.js
app.use('/api/uploads', express.static('uploads'));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Server Configuration
const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,  // Same list use kar rahe hain
    credentials: true,
  },
});

// ============================================
// 🔥 POS NAMESPACE (AUTHENTICATED)
// ============================================
const posNamespace = io.of('/pos');

posNamespace.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));

    const decoded = verifyToken(token);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Unauthorized'));
  }
});

posNamespace.on('connection', (socket) => {
  console.log('✅ POS socket connected:', socket.id, '| User:', socket.user?.name || 'Unknown');

  socket.on('disconnect', () => {
    console.log('❌ POS socket disconnected:', socket.id);
  });
});

// ============================================
// 🌍 PUBLIC NAMESPACE (NO AUTHENTICATION)
// For public order tracking - real-time updates
// ============================================
const publicNamespace = io.of('/public');

// NO authentication middleware - anyone can connect
publicNamespace.on('connection', (socket) => {
  console.log('✅ Public socket connected:', socket.id);

  // Join a room based on order number (optional)
  socket.on('join:order', (orderNumber) => {
    socket.join(`order:${orderNumber}`);
    console.log(`📦 Socket ${socket.id} joined room: order:${orderNumber}`);
  });

  socket.on('leave:order', (orderNumber) => {
    socket.leave(`order:${orderNumber}`);
    console.log(`📦 Socket ${socket.id} left room: order:${orderNumber}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Public socket disconnected:', socket.id);
  });
});

// 🔗 Make io available in controllers
app.set('io', io);

// ============================================
// 🚀 START SERVER
// ============================================
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔡 Socket.IO enabled:`);
  console.log(`   - /pos (authenticated) for admin/staff`);
  console.log(`   - /public (no auth) for order tracking`);
  console.log(`🌍 Public API available at /api/public`);
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  httpServer.close(async () => {
    console.log('✅ HTTP server closed');
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));