import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';

export const validateCreateTable = (req, res, next) => {
  const { tableNumber, capacity } = req.body;
  const errors = [];

  if (!tableNumber || tableNumber.trim() === '') {
    errors.push('Table number is required');
  }

  if (!capacity || capacity < 1) {
    errors.push('Valid table capacity is required');
  }

  if (errors.length > 0) {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Validation failed',
      errors
    );
  }

  next();
};

export const validateUpdateTable = (req, res, next) => {
  const { tableNumber, capacity, status } = req.body;
  const errors = [];

  if (tableNumber !== undefined && tableNumber.trim() === '') {
    errors.push('Table number cannot be empty');
  }

  if (capacity !== undefined && capacity < 1) {
    errors.push('Capacity must be at least 1');
  }

  if (
    status &&
    !['available', 'occupied', 'reserved'].includes(status)
  ) {
    errors.push('Invalid table status');
  }

  if (errors.length > 0) {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Validation failed',
      errors
    );
  }

  next();
};
