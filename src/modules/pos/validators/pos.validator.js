import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';
import { body, param, validationResult } from 'express-validator';
/**
 * Validate Create Category Data
 */
export const validateCreateCategory = (req, res, next) => {
  const { name } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push('Category name must be at least 2 characters');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Create Menu Item Data
 */
export const validateCreateMenuItem = (req, res, next) => {
  const { category, name, price, type } = req.body;
  const errors = [];

  // Category validation
  if (!category) {
    errors.push('Category is required');
  }

  // Name validation
  if (!name || name.trim().length < 2) {
    errors.push('Item name must be at least 2 characters');
  }

  // Price validation
  if (price === undefined || price === null) {
    errors.push('Price is required');
  } else if (price < 0) {
    errors.push('Price cannot be negative');
  }

  // Type validation
  if (type && !['veg', 'non-veg', 'vegan', 'beverage'].includes(type)) {
    errors.push('Invalid item type. Must be: veg, non-veg, vegan, or beverage');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Update Menu Item Data
 */
export const validateUpdateMenuItem = (req, res, next) => {
  const { name, price, type } = req.body;
  const errors = [];

  // Name validation (if provided)
  if (name !== undefined && name.trim().length < 2) {
    errors.push('Item name must be at least 2 characters');
  }

  // Price validation (if provided)
  if (price !== undefined && price < 0) {
    errors.push('Price cannot be negative');
  }

  // Type validation (if provided)
  if (type && !['veg', 'non-veg', 'vegan', 'beverage'].includes(type)) {
    errors.push('Invalid item type');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Create Order Data
 */
export const validateCreateOrder = (req, res, next) => {
  const { orderType, items, customer } = req.body;
  const errors = [];

  // Order type validation
  if (!orderType) {
    errors.push('Order type is required');
  } else if (!['dine-in', 'room-service', 'takeaway'].includes(orderType)) {
    errors.push('Invalid order type. Must be: dine-in, room-service, or takeaway');
  }

  // Items validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('At least one item is required');
  } else {
    items.forEach((item, index) => {
      if (!item.menuItem) {
        errors.push(`Item ${index + 1}: Menu item ID is required`);
      }
      if (!item.quantity || item.quantity < 1) {
        errors.push(`Item ${index + 1}: Valid quantity is required (minimum 1)`);
      }
    });
  }

  // Customer validation (if takeaway or dine-in)
  if (orderType !== 'room-service' && customer) {
    if (customer.phone) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(customer.phone)) {
        errors.push('Valid 10-digit phone number is required');
      }
    }
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Order Status Update
 */
export const validateOrderStatus = (req, res, next) => {
  const { status } = req.body;
  const errors = [];

  if (!status) {
    errors.push('Status is required');
  } else if (!['pending', 'preparing', 'ready', 'served', 'cancelled'].includes(status)) {
    errors.push('Invalid status. Must be: pending, preparing, ready, served, or cancelled');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Item Availability Update
 */
export const validateAvailability = (req, res, next) => {
  const { isAvailable } = req.body;
  const errors = [];

  if (isAvailable === undefined || typeof isAvailable !== 'boolean') {
    errors.push('isAvailable must be a boolean value');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate MongoDB ObjectId
 */
export const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  
  // Basic MongoDB ObjectId validation
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Invalid ID format'
    );
  }

  next();
};


/**
 * Create Sub-Category Validation
 */
export const validateCreateSubCategory = [
  body('category')
    .notEmpty()
    .withMessage('Parent category ID is required')
    .isMongoId()
    .withMessage('Invalid parent category ID'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Sub-category name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  body('image')
    .optional()
    .isURL()
    .withMessage('Image must be a valid URL'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];

/**
 * Update Sub-Category Validation
 */
export const validateUpdateSubCategory = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer'),
  body('image')
    .optional()
    .isURL()
    .withMessage('Image must be a valid URL'),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid parent category ID'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];