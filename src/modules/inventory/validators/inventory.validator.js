import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, INVENTORY_CATEGORIES } from '../../../config/constants.js';

/**
 * Validate Create Inventory Item Data
 */
export const validateCreateInventoryItem = (req, res, next) => {
  const { name, category, unit, pricing } = req.body;
  const errors = [];

  // Name validation
  if (!name || name.trim().length < 2) {
    errors.push('Item name must be at least 2 characters');
  }

  // Category validation
  if (!category || !Object.values(INVENTORY_CATEGORIES).includes(category)) {
    errors.push('Valid category is required (food, beverage, supplies, cleaning, amenities)');
  }

  // Unit validation
  if (!unit) {
    errors.push('Unit is required');
  } else if (!['kg', 'g', 'l', 'ml', 'pcs', 'box', 'packet', 'bottle', 'can'].includes(unit)) {
    errors.push('Invalid unit. Must be: kg, g, l, ml, pcs, box, packet, bottle, or can');
  }

  // Pricing validation
  if (!pricing || pricing.purchasePrice === undefined || pricing.purchasePrice === null) {
    errors.push('Purchase price is required');
  } else if (pricing.purchasePrice < 0) {
    errors.push('Purchase price cannot be negative');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Update Inventory Item Data
 */
export const validateUpdateInventoryItem = (req, res, next) => {
  const { name, category, unit, pricing } = req.body;
  const errors = [];

  // Name validation (if provided)
  if (name !== undefined && name.trim().length < 2) {
    errors.push('Item name must be at least 2 characters');
  }

  // Category validation (if provided)
  if (category && !Object.values(INVENTORY_CATEGORIES).includes(category)) {
    errors.push('Invalid category');
  }

  // Unit validation (if provided)
  if (unit && !['kg', 'g', 'l', 'ml', 'pcs', 'box', 'packet', 'bottle', 'can'].includes(unit)) {
    errors.push('Invalid unit');
  }

  // Pricing validation (if provided)
  if (pricing) {
    if (pricing.purchasePrice !== undefined && pricing.purchasePrice < 0) {
      errors.push('Purchase price cannot be negative');
    }
    if (pricing.sellingPrice !== undefined && pricing.sellingPrice < 0) {
      errors.push('Selling price cannot be negative');
    }
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Stock Adjustment Data
 */
export const validateStockAdjustment = (req, res, next) => {
  const { quantity, type, reason } = req.body;
  const errors = [];

  // Quantity validation
  if (quantity === undefined || quantity === null) {
    errors.push('Quantity is required');
  } else if (quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  // Type validation
  if (!type) {
    errors.push('Type is required');
  } else if (!['add', 'deduct'].includes(type)) {
    errors.push('Type must be either "add" or "deduct"');
  }

  // Reason validation for deductions
  if (type === 'deduct' && (!reason || reason.trim().length === 0)) {
    errors.push('Reason is required for stock deductions');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate MongoDB ObjectId
 */
export const validateInventoryId = (req, res, next) => {
  const { id } = req.params;
  
  // Basic MongoDB ObjectId validation
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Invalid inventory item ID format'
    );
  }

  next();
};