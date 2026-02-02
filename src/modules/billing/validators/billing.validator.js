import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, PAYMENT_METHODS } from '../../../config/constants.js';

/**
 * Validate Generate Invoice Data
 */
export const validateGenerateInvoice = (req, res, next) => {
  const { bookingId } = req.body;
  const errors = [];

  // Booking ID validation
  if (!bookingId) {
    errors.push('Booking ID is required');
  } else {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(bookingId)) {
      errors.push('Invalid booking ID format');
    }
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Add Payment Data
 */
export const validateAddPayment = (req, res, next) => {
  const { amount, method } = req.body;
  const errors = [];

  // Amount validation
  if (amount === undefined || amount === null) {
    errors.push('Payment amount is required');
  } else if (typeof amount !== 'number' || amount <= 0) {
    errors.push('Payment amount must be a positive number');
  }

  // Payment method validation
  if (!method) {
    errors.push('Payment method is required');
  } else if (!Object.values(PAYMENT_METHODS).includes(method)) {
    errors.push('Invalid payment method. Must be: cash, card, upi, wallet, or bank_transfer');
  }

  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate MongoDB ObjectId
 */
export const validateInvoiceId = (req, res, next) => {
  const { id } = req.params;
  
  // Basic MongoDB ObjectId validation
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Invalid invoice ID format'
    );
  }

  next();
};