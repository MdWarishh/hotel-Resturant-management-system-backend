import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, ROOM_TYPES, ROOM_STATUS } from '../../../config/constants.js';

/**
 * Validate Create Room Data
 */
export const validateCreateRoom = (req, res, next) => {
  const { roomNumber, roomType, floor, capacity, pricing, features, images } = req.body;
  const errors = [];

  // Room number validation
  if (!roomNumber || roomNumber.trim().length === 0) {
    errors.push('Room number is required');
  }

  // Room type validation
  if (!roomType || !Object.values(ROOM_TYPES).includes(roomType)) {
    errors.push('Valid room type is required (single, double, deluxe, suite, premium)');
  }

  // Floor validation
  if (floor === undefined || floor === null) {
    errors.push('Floor number is required');
  } else if (floor < 0) {
    errors.push('Floor number cannot be negative');
  }

  // Capacity validation
  if (!capacity) {
    errors.push('Capacity information is required');
  } else {
    if (!capacity.adults || capacity.adults < 1) {
      errors.push('At least 1 adult capacity is required');
    }
    if (capacity.children !== undefined && capacity.children < 0) {
      errors.push('Children capacity cannot be negative');
    }
  }

  // Pricing validation
  if (!pricing) {
    errors.push('Pricing information is required');
  } else {
    if (!pricing.basePrice || pricing.basePrice < 0) {
      errors.push('Valid base price is required');
    }
    if (pricing.weekendPrice !== undefined && pricing.weekendPrice < 0) {
      errors.push('Weekend price cannot be negative');
    }
    if (pricing.extraAdultCharge !== undefined && pricing.extraAdultCharge < 0) {
      errors.push('Extra adult charge cannot be negative');
    }
    if (pricing.extraChildCharge !== undefined && pricing.extraChildCharge < 0) {
      errors.push('Extra child charge cannot be negative');
    }
  }

  if (images) {
    if (!Array.isArray(images)) {
      errors.push('Images must be an array of objects');
    } else {
      images.forEach((img, index) => {
        if (!img.url) errors.push(`Image at index ${index} is missing a URL`);
        if (!img.public_id) errors.push(`Image at index ${index} is missing a Public ID`);
      });
    }
  }

  // Features validation (Ensure 'features' is defined before using it)
  if (features) {
    if (features.bedType && !['single', 'double', 'queen', 'king', 'twin'].includes(features.bedType)) {
      errors.push('Invalid bed type');
    }
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Update Room Data
 */
export const validateUpdateRoom = (req, res, next) => {
  const { roomNumber, roomType, floor, capacity, pricing, features } = req.body;
  const errors = [];

  // Room number validation (if provided)
  if (roomNumber !== undefined && roomNumber.trim().length === 0) {
    errors.push('Room number cannot be empty');
  }

  // Room type validation (if provided)
  if (roomType && !Object.values(ROOM_TYPES).includes(roomType)) {
    errors.push('Invalid room type');
  }

  // Floor validation (if provided)
  if (floor !== undefined && floor < 0) {
    errors.push('Floor number cannot be negative');
  }

  // Capacity validation (if provided)
  if (capacity) {
    if (capacity.adults !== undefined && capacity.adults < 1) {
      errors.push('At least 1 adult capacity is required');
    }
    if (capacity.children !== undefined && capacity.children < 0) {
      errors.push('Children capacity cannot be negative');
    }
  }

  // Pricing validation (if provided)
  if (pricing) {
    if (pricing.basePrice !== undefined && pricing.basePrice < 0) {
      errors.push('Base price cannot be negative');
    }
    if (pricing.weekendPrice !== undefined && pricing.weekendPrice < 0) {
      errors.push('Weekend price cannot be negative');
    }
    if (pricing.extraAdultCharge !== undefined && pricing.extraAdultCharge < 0) {
      errors.push('Extra adult charge cannot be negative');
    }
    if (pricing.extraChildCharge !== undefined && pricing.extraChildCharge < 0) {
      errors.push('Extra child charge cannot be negative');
    }
  }

  // Features validation (if provided)
  if (features) {
    if (features.bedType && !['single', 'double', 'queen', 'king', 'twin'].includes(features.bedType)) {
      errors.push('Invalid bed type');
    }
    if (features.view && !['city', 'garden', 'pool', 'mountain', 'ocean', 'none'].includes(features.view)) {
      errors.push('Invalid view type');
    }
    if (features.bathroom && !['shared', 'attached', 'premium'].includes(features.bathroom)) {
      errors.push('Invalid bathroom type');
    }
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Room Status Update
 */
export const validateRoomStatus = (req, res, next) => {
  const { status } = req.body;
  const errors = [];

  // Status validation
  if (!status) {
    errors.push('Status is required');
  } else if (!Object.values(ROOM_STATUS).includes(status)) {
    errors.push('Invalid status. Must be: available, occupied, maintenance, cleaning, or reserved');
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate MongoDB ObjectId
 */
export const validateRoomId = (req, res, next) => {
  const { id } = req.params;
  
  // Basic MongoDB ObjectId validation
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Invalid room ID format'
    );
  }

  next();
};