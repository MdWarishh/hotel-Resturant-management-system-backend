import InventoryItem from '../models/InventoryItem.model.js';
import StockTransaction from '../models/StockTransaction.model.js';
import { successResponse, paginatedResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAGINATION, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Create Inventory Item
 * POST /api/inventory
 * Access: Hotel Admin, Manager
 */
export const createInventoryItem = asyncHandler(async (req, res) => {
  const {
    hotel,
    name,
    category,
    sku,
    description,
    unit,
    quantity,
    pricing,
    supplier,
    storage,
    expiryTracking,
    reorderPoint,
  } = req.body;

  // Authorization
  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  // Check if SKU already exists
  if (sku) {
    const existingSKU = await InventoryItem.findOne({ sku: sku.toUpperCase() });
    if (existingSKU) {
      throw new AppError('SKU already exists', HTTP_STATUS.CONFLICT);
    }
  }

  // Create inventory item
  const item = await InventoryItem.create({
    hotel: assignedHotel,
    name: name.trim(),
    category,
    sku: sku ? sku.toUpperCase() : undefined,
    description,
    unit,
    quantity,
    pricing,
    supplier,
    storage,
    expiryTracking,
    reorderPoint,
    createdBy: req.user._id,
  });

  // Create initial stock transaction if quantity > 0
  if (quantity?.current > 0) {
    await StockTransaction.create({
      hotel: assignedHotel,
      inventoryItem: item._id,
      transactionType: 'purchase',
      quantity: quantity.current,
      unit,
      previousStock: 0,
      newStock: quantity.current,
      cost: {
        unitPrice: pricing?.purchasePrice || 0,
        totalPrice: (pricing?.purchasePrice || 0) * quantity.current,
      },
      reference: {
        type: 'manual',
      },
      reason: 'Initial stock',
      performedBy: req.user._id,
    });
  }

  const populatedItem = await InventoryItem.findById(item._id).populate('hotel', 'name code');

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Inventory item created successfully',
    { item: populatedItem }
  );
});

/**
 * Get All Inventory Items
 * GET /api/inventory
 * Access: Authenticated users
 */
export const getAllInventoryItems = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    hotel,
    category,
    stockStatus,
    search,
  } = req.query;

  // Build query
  const query = { isActive: true };

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    query.hotel = req.user.hotel._id;
  } else if (hotel) {
    query.hotel = hotel;
  }

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { name: new RegExp(search, 'i') },
      { sku: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch items
  let items = await InventoryItem.find(query)
    .populate('hotel', 'name code')
    .sort({ name: 1 })
    .skip(skip)
    .limit(limitNum);

  // Filter by stock status if needed (post-query filter due to virtual)
  if (stockStatus) {
    items = items.filter((item) => item.stockStatus === stockStatus);
  }

  const total = await InventoryItem.countDocuments(query);

  return paginatedResponse(
    res,
    items,
    pageNum,
    limitNum,
    total,
    'Inventory items fetched successfully'
  );
});

/**
 * Get Single Inventory Item
 * GET /api/inventory/:id
 * Access: Authenticated users
 */
export const getInventoryItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const item = await InventoryItem.findById(id).populate('hotel', 'name code');

  if (!item) {
    throw new AppError('Inventory item not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || item.hotel._id.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to this item', HTTP_STATUS.FORBIDDEN);
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Inventory item details fetched successfully',
    { item }
  );
});

/**
 * Update Inventory Item
 * PUT /api/inventory/:id
 * Access: Hotel Admin, Manager
 */
export const updateInventoryItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const item = await InventoryItem.findById(id);

  if (!item) {
    throw new AppError('Inventory item not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization check
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || item.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to update this item', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Don't allow direct quantity update (use adjust stock endpoint)
  if (updateData.quantity) {
    delete updateData.quantity;
  }

  // Update item
  const updatedItem = await InventoryItem.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate('hotel', 'name code');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Inventory item updated successfully',
    { item: updatedItem }
  );
});

/**
 * Adjust Stock
 * POST /api/inventory/:id/adjust
 * Access: Hotel Admin, Manager
 */
export const adjustStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, type, reason, cost } = req.body;

  if (!quantity || quantity <= 0) {
    throw new AppError('Quantity must be greater than zero', HTTP_STATUS.BAD_REQUEST);
  }

  if (!['add', 'deduct'].includes(type)) {
    throw new AppError('Invalid stock adjustment type', HTTP_STATUS.BAD_REQUEST);
  }

  const item = await InventoryItem.findById(id);

  if (!item) {
    throw new AppError('Inventory item not found', HTTP_STATUS.NOT_FOUND);
  }

  // Authorization
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || item.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied to adjust this item', HTTP_STATUS.FORBIDDEN);
    }
  }

  const previousStock = item.quantity.current;

  // Update stock
  item.updateStock(quantity, type);
  await item.save();

  // 🔥 Transaction type mapping
  let transactionType = 'adjustment';

  if (type === 'add') {
    transactionType = 'purchase';
  }

  if (type === 'deduct') {
    transactionType = reason === 'wastage' ? 'wastage' : 'usage';
  }

  // Create stock transaction
  await StockTransaction.create({
    hotel: item.hotel,
    inventoryItem: item._id,
    transactionType,
    quantity,
    unit: item.unit,
    previousStock,
    newStock: item.quantity.current,
    cost: cost || { unitPrice: 0, totalPrice: 0 },
    reference: { type: 'manual' },
    reason: reason || '',
    performedBy: req.user._id,
  });

  return successResponse(res, HTTP_STATUS.OK, 'Stock adjusted successfully', {
    item,
    previousStock,
    newStock: item.quantity.current,
    change: type === 'add' ? `+${quantity}` : `-${quantity}`,
  });
});

/**
 * Get Low Stock Items
 * GET /api/inventory/alerts/low-stock
 * Access: Hotel Admin, Manager
 */
export const getLowStockItems = asyncHandler(async (req, res) => {
  const { hotel } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  const items = await InventoryItem.find({
    hotel: assignedHotel,
    isActive: true,
    $expr: { $lte: ['$quantity.current', '$quantity.minimum'] },
  })
    .populate('hotel', 'name code')
    .sort({ 'quantity.current': 1 });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Low stock items fetched successfully',
    { items, count: items.length }
  );
});

/**
 * Get Stock Transactions
 * GET /api/inventory/:id/transactions
 * Access: Authenticated users
 */
export const getStockTransactions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, transactionType } = req.query;

  // Verify item exists and user has access
  const item = await InventoryItem.findById(id);

  if (!item) {
    throw new AppError('Inventory item not found', HTTP_STATUS.NOT_FOUND);
  }

  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    if (!req.user.hotel || item.hotel.toString() !== req.user.hotel._id.toString()) {
      throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
    }
  }

  // Build query
  const query = { inventoryItem: id };

  if (transactionType) {
    query.transactionType = transactionType;
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), PAGINATION.MAX_LIMIT);
  const skip = (pageNum - 1) * limitNum;

  // Fetch transactions
  const transactions = await StockTransaction.find(query)
    .populate('performedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await StockTransaction.countDocuments(query);

  return paginatedResponse(
    res,
    transactions,
    pageNum,
    limitNum,
    total,
    'Transactions fetched successfully'
  );
});