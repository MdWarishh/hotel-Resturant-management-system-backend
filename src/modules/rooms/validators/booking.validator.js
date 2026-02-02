import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';

/**
 * Validate Create Booking Data
 */
export const validateCreateBooking = (req, res, next) => {
  const { room, guest, numberOfGuests, dates } = req.body;
  const errors = [];

  // Room validation
  if (!room) {
    errors.push('Room ID is required');
  }

  // Guest validation
  if (!guest) {
    errors.push('Guest information is required');
  } else {
    if (!guest.name || guest.name.trim().length < 2) {
      errors.push('Guest name is required and must be at least 2 characters');
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!guest.phone || !phoneRegex.test(guest.phone)) {
      errors.push('Valid 10-digit phone number is required');
    }

    if (guest.email) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(guest.email)) {
        errors.push('Valid email is required');
      }
    }
  }

  // Number of guests validation
  if (!numberOfGuests) {
    errors.push('Number of guests is required');
  } else {
    if (!numberOfGuests.adults || numberOfGuests.adults < 1) {
      errors.push('At least 1 adult is required');
    }
    if (numberOfGuests.children !== undefined && numberOfGuests.children < 0) {
      errors.push('Number of children cannot be negative');
    }
  }

  // Dates validation
  if (!dates) {
    errors.push('Check-in and check-out dates are required');
  } else {
    if (!dates.checkIn) {
      errors.push('Check-in date is required');
    }
    if (!dates.checkOut) {
      errors.push('Check-out date is required');
    }

    if (dates.checkIn && dates.checkOut) {
      const checkIn = new Date(dates.checkIn);
      const checkOut = new Date(dates.checkOut);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isNaN(checkIn.getTime())) {
        errors.push('Invalid check-in date');
      }
      if (isNaN(checkOut.getTime())) {
        errors.push('Invalid check-out date');
      }

      if (checkIn < today) {
        errors.push('Check-in date cannot be in the past');
      }
      if (checkOut <= checkIn) {
        errors.push('Check-out date must be after check-in date');
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
 * Validate Booking ID
 */
export const validateBookingId = (req, res, next) => {
  const { id } = req.params;
  
  // Basic MongoDB ObjectId validation
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  
  if (!objectIdRegex.test(id)) {
    return errorResponse(
      res,
      HTTP_STATUS.BAD_REQUEST,
      'Invalid booking ID format'
    );
  }

  next();
};