// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  HOTEL_ADMIN: 'hotel_admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  KITCHEN_STAFF: 'kitchen_staff',
};

// User Status
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

// Room Status
export const ROOM_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  CLEANING: 'cleaning',
  RESERVED: 'reserved',
};

// Room Types
export const ROOM_TYPES = {
  SINGLE: 'single',
  DOUBLE: 'double',
  DELUXE: 'deluxe',
  SUITE: 'suite',
  PREMIUM: 'premium',
};

// Booking Status
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
};

// Order Status (POS)
export const ORDER_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
   COMPLETED: 'completed', 
  CANCELLED: 'cancelled',
};

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PARTIALLY_PAID: 'partially_paid',
  REFUNDED: 'refunded',
};

// Payment Methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  WALLET: 'wallet',
  BANK_TRANSFER: 'bank_transfer',
};

// Invoice Status
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  GENERATED: 'generated',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

// Inventory Categories
export const INVENTORY_CATEGORIES = {
  FOOD: 'food',
  BEVERAGE: 'beverage',
  SUPPLIES: 'supplies',
  CLEANING: 'cleaning',
  AMENITIES: 'amenities',
};

// Stock Alert Levels
export const STOCK_LEVELS = {
  LOW: 10,
  CRITICAL: 5,
};

// GST Rate (India)
export const GST_RATE = parseFloat(process.env.GST_RATE) || 5;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: parseInt(process.env.DEFAULT_PAGE_SIZE) || 20,
  MAX_LIMIT: parseInt(process.env.MAX_PAGE_SIZE) || 100,
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

// Error Messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_EXISTS: 'User already exists',
  HOTEL_NOT_FOUND: 'Hotel not found',
  ROOM_NOT_FOUND: 'Room not found',
  INVALID_TOKEN: 'Invalid or expired token',
  SERVER_ERROR: 'Internal server error',
};