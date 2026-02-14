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

// ============================================
// CORS CONFIGURATION (Hostinger + Vercel Fix)
// ============================================
console.log("MONGO URI:", process.env.MONGO_URI);
console.log("MONGODB_URI:", process.env.MONGODB_URI);

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://fusionpos.in',
  'https://www.fusionpos.in',
  'https://api.fusionpos.in',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow no-origin requests (Postman, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS request from unlisted origin:', origin);
      callback(null, true); // allow anyway, just log
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

// Apply CORS to all routes including preflight OPTIONS
app.use(cors(corsOptions));

// ============================================
// BODY PARSER
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

connectDB();

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FusionPOS API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================
// IMPORT ROUTES
// ============================================
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
import allinoneRoutes from './src/modules/pos/routes/allinone.routes.js';
import gstReportsRoutes from './src/modules/reports/routes/gstReports.routes.js';

// ============================================
// MOUNT ROUTES
// ============================================
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
app.use('/api/allinone', allinoneRoutes);
app.use('/api/reports/gst', gstReportsRoutes);
app.use('/api/uploads', express.static('uploads'));

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS: Origin not allowed' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============================================
// SERVER + SOCKET.IO
// ============================================
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

// ============================================
// POS NAMESPACE (AUTHENTICATED)
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
  console.log('POS socket connected:', socket.id, '| User:', socket.user?.name || 'Unknown');
  socket.on('disconnect', () => console.log('POS socket disconnected:', socket.id));
});

// ============================================
// ALLINONE NAMESPACE (NO AUTH)
// ============================================
const allinoneNamespace = io.of('/allinone');

allinoneNamespace.on('connection', (socket) => {
  console.log('AllInOne socket connected:', socket.id);
  socket.on('join:order', (orderNumber) => socket.join(`order:${orderNumber}`));
  socket.on('leave:order', (orderNumber) => socket.leave(`order:${orderNumber}`));
  socket.on('disconnect', () => console.log('AllInOne socket disconnected:', socket.id));
});

app.set('io', io);

// ============================================
// START SERVER
// ============================================
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS allowed origins:`, allowedOrigins);
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down...`);
  httpServer.close(async () => {
    try {
      await mongoose.connection.close();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));