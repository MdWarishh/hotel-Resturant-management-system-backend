// backend/src/modules/pos/controllers/qrAndFeedback.controller.js

import QRCode from 'qrcode';
import Hotel from '../../hotels/models/Hotel.model.js';
import MenuItem from '../models/MenuItem.model.js';
import Feedback from '../models/Feedback.model.js';
import Order from '../models/Order.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * 🔲 GENERATE QR CODE FOR HOTEL
 * GET /api/pos/qr-code
 * Access: Hotel Admin, Manager
 */
export const generateHotelQR = asyncHandler(async (req, res) => {
  const hotelId = req.user.hotel;

  // Get hotel details
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Generate public menu URL
  const frontendUrl = process.env.FRONTEND_URL || 'https://www.fusionpos.in/allinone';
  const menuUrl = `${frontendUrl}`;

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(menuUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.95,
    margin: 1,
    width: 512,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'QR Code generated successfully',
    {
      qrCode: qrCodeDataUrl,
      menuUrl,
      hotel: {
        name: hotel.name,
        code: hotel.code,
      },
    }
  );
});

/**
 * ⭐ SUBMIT FEEDBACK (Public - No Auth)
 * POST /api/public/:hotelCode/feedback
 */
export const submitFeedback = asyncHandler(async (req, res) => {
  const { hotelCode } = req.params;
  const { menuItemId, orderNumber, rating, comment, customer } = req.body;

  // Validate hotel
  const hotel = await Hotel.findOne({ code: hotelCode.toUpperCase() });
  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Validate menu item
  const menuItem = await MenuItem.findOne({
    _id: menuItemId,
    hotel: hotel._id,
  });
  if (!menuItem) {
    throw new AppError('Menu item not found', HTTP_STATUS.NOT_FOUND);
  }

  // Validate rating
  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', HTTP_STATUS.BAD_REQUEST);
  }

  // Validate customer info
  if (!customer || !customer.name || !customer.phone) {
    throw new AppError('Customer name and phone are required', HTTP_STATUS.BAD_REQUEST);
  }

  // Find order (optional)
  let order = null;
  if (orderNumber) {
    order = await Order.findOne({
      hotel: hotel._id,
      orderNumber: orderNumber.toUpperCase(),
    });
  }

  // Create feedback
  const feedback = await Feedback.create({
    hotel: hotel._id,
    menuItem: menuItem._id,
    order: order?._id || null,
    customer: {
      name: customer.name.trim(),
      phone: customer.phone,
    },
    rating,
    comment: comment?.trim() || '',
    isApproved: true, // Auto-approve
  });

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Thank you for your feedback!',
    { feedback }
  );
});

/**
 * ⭐ GET ITEM FEEDBACK (Public)
 * GET /api/public/:hotelCode/items/:itemId/feedback
 */
export const getItemFeedback = asyncHandler(async (req, res) => {
  const { hotelCode, itemId } = req.params;

  // Validate hotel
  const hotel = await Hotel.findOne({ code: hotelCode.toUpperCase() });
  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Get feedbacks
  const feedbacks = await Feedback.find({
    hotel: hotel._id,
    menuItem: itemId,
    isApproved: true,
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('rating comment customer.name createdAt');

  // Get average rating
  const stats = await Feedback.getAverageRating(itemId);

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Feedback fetched successfully',
    {
      feedbacks,
      stats: {
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews,
      },
    }
  );
});

/**
 * ⭐ GET HOTEL FEEDBACK SUMMARY (Admin)
 * GET /api/pos/feedback/summary
 */
export const getFeedbackSummary = asyncHandler(async (req, res) => {
  const hotelId = req.user.hotel;

  // Total feedbacks
  const totalFeedbacks = await Feedback.countDocuments({
    hotel: hotelId,
    isApproved: true,
  });

  // Average rating
  const avgResult = await Feedback.aggregate([
    {
      $match: {
        hotel: hotelId,
        isApproved: true,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
      },
    },
  ]);

  const averageRating = avgResult.length > 0 
    ? Math.round(avgResult[0].averageRating * 10) / 10 
    : 0;

  // Rating distribution
  const distribution = await Feedback.aggregate([
    {
      $match: {
        hotel: hotelId,
        isApproved: true,
      },
    },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: -1 },
    },
  ]);

  // Recent feedbacks
  const recentFeedbacks = await Feedback.find({
    hotel: hotelId,
    isApproved: true,
  })
    .populate('menuItem', 'name')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('rating comment customer.name menuItem createdAt');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Feedback summary fetched successfully',
    {
      summary: {
        totalFeedbacks,
        averageRating,
        distribution,
      },
      recentFeedbacks,
    }
  );
});