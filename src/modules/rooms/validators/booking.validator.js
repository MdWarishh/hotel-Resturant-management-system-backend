import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';

/**
 * Validate Create Booking Data
 */
export const validateCreateBooking = (req, res, next) => {
  const { room, guest, numberOfGuests, dates, source, bookingType, hours } = req.body;
  const errors = [];

  // Room validation
  if (!room) {
    errors.push('Room ID is required');
  }

  // 🔥 NEW: Booking type validation
  if (!bookingType) {
    errors.push('Booking type is required (daily or hourly)');
  } else if (!['daily', 'hourly'].includes(bookingType)) {
    errors.push('Booking type must be either "daily" or "hourly"');
  }

  // 🔥 NEW: Hours validation for hourly bookings
  if (bookingType === 'hourly') {
    if (!hours || hours < 1 || hours > 12) {
      errors.push('Hours must be between 1 and 12 for hourly bookings');
    }
    if (!Number.isInteger(Number(hours))) {
      errors.push('Hours must be a whole number');
    }
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

      // 🔥 UPDATED: Different validation for daily vs hourly
      if (bookingType === 'daily') {
        // For daily bookings, check-in should not be in the past
        if (checkIn < today) {
          errors.push('Check-in date cannot be in the past');
        }
        if (checkOut <= checkIn) {
          errors.push('Check-out date must be after check-in date');
        }
      } else if (bookingType === 'hourly') {
        // For hourly bookings, allow today but must be in future
        const now = new Date();
        if (checkIn < now) {
          errors.push('Check-in time cannot be in the past');
        }
        
        // Calculate expected checkout based on hours
        if (hours) {
          const expectedCheckOut = new Date(checkIn.getTime() + hours * 60 * 60 * 1000);
          const timeDiff = Math.abs(checkOut - expectedCheckOut);
          
          // Allow 5 minute tolerance
          if (timeDiff > 5 * 60 * 1000) {
            errors.push(`Check-out time must be exactly ${hours} hours after check-in`);
          }
        }
      }
    }
  }

  // Source validation
  const validSources = ['Direct', 'OYO', 'MakeMyTrip', 'Booking.com', 'Goibibo', 'Airbnb', 'Agoda', 'Other'];
  if (source && !validSources.includes(source)) {
    errors.push(`Invalid booking source. Allowed: ${validSources.join(', ')}`);
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