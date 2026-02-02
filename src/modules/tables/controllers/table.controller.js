import Table from '../models/Table.model.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES } from '../../../config/constants.js';

/**
 * CREATE TABLE
 * POST /api/tables
 */
export const createTable = asyncHandler(async (req, res) => {
  const { tableNumber, capacity } = req.body;

  const hotelId =
    req.user.role === USER_ROLES.SUPER_ADMIN
      ? req.body.hotel
      : req.user.hotel?._id;

  if (!hotelId) {
    throw new AppError('Hotel is required', HTTP_STATUS.BAD_REQUEST);
  }

  const table = await Table.create({
    hotel: hotelId,
    tableNumber,
    capacity,
    createdBy: req.user._id,
  });

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    'Table created successfully',
    { table }
  );
});

/**
 * GET TABLES (HOTEL WISE)
 * GET /api/tables?hotel=HOTEL_ID
 */
export const getTables = asyncHandler(async (req, res) => {
  const hotelId =
    req.user.role === USER_ROLES.SUPER_ADMIN
      ? req.query.hotel
      : req.user.hotel?._id;

  if (!hotelId) {
    throw new AppError('Hotel is required', HTTP_STATUS.BAD_REQUEST);
  }

  const tables = await Table.find({ hotel: hotelId }).sort({
    tableNumber: 1,
  });

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Tables fetched successfully',
    tables
  );
});

/**
 * UPDATE TABLE
 * PUT /api/tables/:id
 */
export const updateTable = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.id);

  if (!table) {
    throw new AppError('Table not found', HTTP_STATUS.NOT_FOUND);
  }

  // 🔒 Hotel access check
  if (
    req.user.role !== USER_ROLES.SUPER_ADMIN &&
    table.hotel.toString() !== req.user.hotel._id.toString()
  ) {
    throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
  }

  Object.assign(table, req.body);
  await table.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Table updated successfully',
    { table }
  );
});

/**
 * UPDATE TABLE STATUS
 * PATCH /api/tables/:id/status
 */
export const updateTableStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['available', 'occupied', 'reserved'].includes(status)) {
    throw new AppError('Invalid table status', HTTP_STATUS.BAD_REQUEST);
  }

  const table = await Table.findById(req.params.id);

  if (!table) {
    throw new AppError('Table not found', HTTP_STATUS.NOT_FOUND);
  }

  // 🔒 Hotel access check
  if (
    req.user.role !== USER_ROLES.SUPER_ADMIN &&
    table.hotel.toString() !== req.user.hotel._id.toString()
  ) {
    throw new AppError('Access denied', HTTP_STATUS.FORBIDDEN);
  }

  table.status = status;
  await table.save();

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Table status updated',
    { table }
  );
});
