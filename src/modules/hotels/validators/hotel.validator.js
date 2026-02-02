import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';

/**
 * Validate Create Hotel Data
 */
export const validateCreateHotel = (req, res, next) => {
  const { name, code, address, contact, gst } = req.body;
  const errors = [];

  // Hotel name validation
  if (!name || name.trim().length < 3) {
    errors.push('Hotel name must be at least 3 characters');
  }

  // Hotel code validation
  const codeRegex = /^[A-Z0-9]{3,10}$/;
  if (!code || !codeRegex.test(code.toUpperCase())) {
    errors.push('Hotel code must be 3-10 alphanumeric characters');
  }

  // Address validation
  if (!address) {
    errors.push('Address is required');
  } else {
    if (!address.street || !address.street.trim()) {
      errors.push('Street address is required');
    }
    if (!address.city || !address.city.trim()) {
      errors.push('City is required');
    }
    if (!address.state || !address.state.trim()) {
      errors.push('State is required');
    }
    const pincodeRegex = /^[0-9]{6}$/;
    if (!address.pincode || !pincodeRegex.test(address.pincode)) {
      errors.push('Valid 6-digit pincode is required');
    }
  }

  // Contact validation
  if (!contact) {
    errors.push('Contact information is required');
  } else {
    const phoneRegex = /^[0-9]{10}$/;
    if (!contact.phone || !phoneRegex.test(contact.phone)) {
      errors.push('Valid 10-digit phone number is required');
    }

    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!contact.email || !emailRegex.test(contact.email)) {
      errors.push('Valid email is required');
    }
  }

  // GST validation
  if (!gst) {
    errors.push('GST information is required');
  } else {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gst.number || !gstRegex.test(gst.number.toUpperCase())) {
      errors.push('Valid GST number is required (format: 22AAAAA0000A1Z5)');
    }
    if (!gst.name || !gst.name.trim()) {
      errors.push('Business name for GST is required');
    }
  }

  // If errors exist, return error response
  if (errors.length > 0) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Validation failed', errors);
  }

  next();
};

/**
 * Validate Update Hotel Data
 */
export const validateUpdateHotel = (req, res, next) => {
  const { name, code, address, contact, gst, settings } = req.body;
  const errors = [];

  // Hotel name validation (if provided)
  if (name && name.trim().length < 3) {
    errors.push('Hotel name must be at least 3 characters');
  }

  // Hotel code validation (if provided)
  if (code) {
    const codeRegex = /^[A-Z0-9]{3,10}$/;
    if (!codeRegex.test(code.toUpperCase())) {
      errors.push('Hotel code must be 3-10 alphanumeric characters');
    }
  }

  // Address validation (if provided)
  if (address) {
    if (address.pincode) {
      const pincodeRegex = /^[0-9]{6}$/;
      if (!pincodeRegex.test(address.pincode)) {
        errors.push('Valid 6-digit pincode is required');
      }
    }
  }

  // Contact validation (if provided)
  if (contact) {
    if (contact.phone) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(contact.phone)) {
        errors.push('Valid 10-digit phone number is required');
      }
    }

    if (contact.email) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(contact.email)) {
        errors.push('Valid email is required');
      }
    }
  }

  // GST validation (if provided)
  if (gst) {
    if (gst.number) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(gst.number.toUpperCase())) {
        errors.push('Valid GST number is required');
      }
    }
  }

  // Settings validation (if provided)
  if (settings) {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (settings.checkInTime && !timeRegex.test(settings.checkInTime)) {
      errors.push('Check-in time must be in HH:MM format (24-hour)');
    }

    if (settings.checkOutTime && !timeRegex.test(settings.checkOutTime)) {
      errors.push('Check-out time must be in HH:MM format (24-hour)');
    }

    if (settings.taxRate !== undefined) {
      const taxRate = parseFloat(settings.taxRate);
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        errors.push('Tax rate must be between 0 and 100');
      }
    }
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
export const validateHotelId = (req, res, next) => {
  const { id } = req.params;
  
  // Basic MongoDB ObjectId validation
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Invalid hotel ID format'
    );
  }

  next();
};