import { errorResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';

/**
 * Validate Create Booking Data
 * ✅ Loose validation — client ki request per strict checks hataaye
 */
export const validateCreateBooking = (req, res, next) => {
  const { room, guest, numberOfGuests, dates, source, bookingType, hours } = req.body;
  const errors = [];

  // Room validation
  if (!room) {
    errors.push('Room ID is required');
  }

  // Booking type validation
  if (!bookingType) {
    errors.push('Booking type is required (daily or hourly)');
  } else if (!['daily', 'hourly'].includes(bookingType)) {
    errors.push('Booking type must be either "daily" or "hourly"');
  }

  // Hours validation for hourly (only range check, no integer check)
  if (bookingType === 'hourly') {
    if (!hours || Number(hours) < 1) {
      errors.push('Hours must be at least 1 for hourly bookings');
    }
  }

  // Guest validation — only name required, phone just needs to exist
  if (!guest) {
    errors.push('Guest information is required');
  } else {
    if (!guest.name || guest.name.trim().length < 1) {
      errors.push('Guest name is required');
    }

    if (!guest.phone || guest.phone.toString().trim().length < 1) {
      errors.push('Phone number is required');
    }

    // ✅ Email validation only if provided
    if (guest.email && guest.email.trim().length > 0) {
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(guest.email)) {
        errors.push('Please enter a valid email address');
      }
    }
  }

  // Number of guests — only adults required
  if (!numberOfGuests) {
    errors.push('Number of guests is required');
  } else {
    if (!numberOfGuests.adults || numberOfGuests.adults < 1) {
      errors.push('At least 1 adult is required');
    }
  }

  // Dates — only check-in required
  if (!dates) {
    errors.push('Check-in date is required');
  } else {
    if (!dates.checkIn) {
      errors.push('Check-in date is required');
    }

    // ✅ For daily: checkOut required
    if (bookingType === 'daily' && !dates.checkOut) {
      errors.push('Check-out date is required for daily bookings');
    }

    // ✅ Only basic date sanity check — no past date restriction
    if (dates.checkIn && dates.checkOut) {
      const checkIn = new Date(dates.checkIn);
      const checkOut = new Date(dates.checkOut);

      if (isNaN(checkIn.getTime())) {
        errors.push('Invalid check-in date');
      }
      if (isNaN(checkOut.getTime())) {
        errors.push('Invalid check-out date');
      }

      if (!isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
        if (checkOut <= checkIn) {
          errors.push('Check-out must be after check-in');
        }
      }
    }
  }

  // Source validation — only if provided
  const validSources = ['Direct', 'OYO', 'MakeMyTrip', 'Booking.com', 'Goibibo', 'Airbnb', 'Agoda', 'Other'];
  if (source && !validSources.includes(source)) {
    errors.push(`Invalid booking source. Allowed: ${validSources.join(', ')}`);
  }

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
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;

  if (!objectIdRegex.test(id)) {
    return errorResponse(res, HTTP_STATUS.BAD_REQUEST, 'Invalid booking ID format');
  }

  next();
};