// backend/src/modules/rooms/controllers/bulkUpload.controller.js

import ExcelJS from 'exceljs';
import Room from '../models/Room.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, ROOM_TYPES, ROOM_STATUS } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * 🔥 Download Rooms Excel Template
 * GET /api/rooms/bulk-upload/template
 */
export const downloadRoomsTemplate = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Rooms Template');

  // Define columns
  worksheet.columns = [
    { header: 'Room Number*', key: 'roomNumber', width: 15 },
    { header: 'Room Type*', key: 'roomType', width: 15 },
    { header: 'Floor*', key: 'floor', width: 10 },
    { header: 'Base Price*', key: 'basePrice', width: 12 },
    { header: 'Hourly Rate', key: 'hourlyRate', width: 12 },
    { header: 'Weekend Price', key: 'weekendPrice', width: 15 },
    { header: 'Adults Capacity*', key: 'adultsCapacity', width: 15 },
    { header: 'Children Capacity', key: 'childrenCapacity', width: 18 },
    { header: 'Extra Adult Charge', key: 'extraAdultCharge', width: 18 },
    { header: 'Extra Child Charge', key: 'extraChildCharge', width: 18 },
    { header: 'Bed Type', key: 'bedType', width: 12 },
    { header: 'View', key: 'view', width: 12 },
    { header: 'Bathroom', key: 'bathroom', width: 12 },
    { header: 'Balcony (Yes/No)', key: 'balcony', width: 15 },
    { header: 'Smoking (Yes/No)', key: 'smoking', width: 15 },
    { header: 'Pets (Yes/No)', key: 'pets', width: 15 },
    { header: 'Hourly Booking (Yes/No)', key: 'allowHourly', width: 20 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'Amenities (comma-separated)', key: 'amenities', width: 30 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4472C4' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 25;

  // Add instruction row
  const instructionRow = worksheet.addRow({
    roomNumber: 'e.g., 101',
    roomType: 'deluxe/standard/suite/single/double',
    floor: '0, 1, 2, 3...',
    basePrice: '2000',
    hourlyRate: '500 (optional)',
    weekendPrice: '2500 (optional)',
    adultsCapacity: '2',
    childrenCapacity: '1',
    extraAdultCharge: '300 (optional)',
    extraChildCharge: '150 (optional)',
    bedType: 'single/double/queen/king/twin',
    view: 'city/garden/pool/mountain/ocean/none',
    bathroom: 'shared/attached/premium',
    balcony: 'Yes or No',
    smoking: 'Yes or No',
    pets: 'Yes or No',
    allowHourly: 'Yes or No',
    description: 'Room description here',
    amenities: 'WiFi, AC, TV, Mini Fridge'
  });
  instructionRow.font = { italic: true, color: { argb: '808080' } };
  instructionRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F0F0F0' }
  };

  // Add sample data rows
  worksheet.addRow({
    roomNumber: '101',
    roomType: 'deluxe',
    floor: 1,
    basePrice: 2000,
    hourlyRate: 500,
    weekendPrice: 2500,
    adultsCapacity: 2,
    childrenCapacity: 1,
    extraAdultCharge: 300,
    extraChildCharge: 150,
    bedType: 'queen',
    view: 'city',
    bathroom: 'attached',
    balcony: 'Yes',
    smoking: 'No',
    pets: 'No',
    allowHourly: 'Yes',
    description: 'Spacious deluxe room with city view',
    amenities: 'WiFi, AC, TV, Mini Fridge, Safe'
  });

  worksheet.addRow({
    roomNumber: '102',
    roomType: 'standard',
    floor: 1,
    basePrice: 1500,
    hourlyRate: 400,
    weekendPrice: 1800,
    adultsCapacity: 2,
    childrenCapacity: 1,
    extraAdultCharge: 250,
    extraChildCharge: 100,
    bedType: 'double',
    view: 'garden',
    bathroom: 'attached',
    balcony: 'No',
    smoking: 'No',
    pets: 'No',
    allowHourly: 'Yes',
    description: 'Comfortable standard room',
    amenities: 'WiFi, AC, TV'
  });

  // Add borders
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'CCCCCC' } },
        left: { style: 'thin', color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
        right: { style: 'thin', color: { argb: 'CCCCCC' } }
      };
    });
  });

  // Add notes sheet
  const notesSheet = workbook.addWorksheet('Instructions');
  notesSheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Required?', key: 'required', width: 12 },
    { header: 'Valid Values', key: 'values', width: 50 },
  ];

  notesSheet.getRow(1).font = { bold: true };
  notesSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4472C4' }
  };
  notesSheet.getRow(1).font = { color: { argb: 'FFFFFF' }, bold: true };

  const instructions = [
    { field: 'Room Number', required: 'Yes', values: 'Unique identifier (e.g., 101, 102, A1, B2)' },
    { field: 'Room Type', required: 'Yes', values: 'deluxe, standard, suite, single, double' },
    { field: 'Floor', required: 'Yes', values: 'Number (0, 1, 2, 3...)' },
    { field: 'Base Price', required: 'Yes', values: 'Number (daily rate in rupees)' },
    { field: 'Hourly Rate', required: 'No', values: 'Number (hourly rate in rupees)' },
    { field: 'Weekend Price', required: 'No', values: 'Number (if different from base price)' },
    { field: 'Adults Capacity', required: 'Yes', values: 'Number (minimum 1)' },
    { field: 'Children Capacity', required: 'No', values: 'Number (default 0)' },
    { field: 'Extra Adult Charge', required: 'No', values: 'Number (per night)' },
    { field: 'Extra Child Charge', required: 'No', values: 'Number (per night)' },
    { field: 'Bed Type', required: 'No', values: 'single, double, queen, king, twin' },
    { field: 'View', required: 'No', values: 'city, garden, pool, mountain, ocean, none' },
    { field: 'Bathroom', required: 'No', values: 'shared, attached, premium' },
    { field: 'Balcony', required: 'No', values: 'Yes or No' },
    { field: 'Smoking Allowed', required: 'No', values: 'Yes or No' },
    { field: 'Pets Allowed', required: 'No', values: 'Yes or No' },
    { field: 'Allow Hourly Booking', required: 'No', values: 'Yes or No' },
    { field: 'Description', required: 'No', values: 'Text (max 500 characters)' },
    { field: 'Amenities', required: 'No', values: 'Comma-separated (e.g., WiFi, AC, TV)' },
  ];

  instructions.forEach(inst => notesSheet.addRow(inst));

  // Set response headers
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=Rooms_Upload_Template.xlsx'
  );

  // Write to response
  await workbook.xlsx.write(res);
  res.end();
});

/**
 * 🔥 Upload and Process Rooms Excel File
 * POST /api/rooms/bulk-upload
 */
export const bulkUploadRooms = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please upload an Excel file', HTTP_STATUS.BAD_REQUEST);
  }

  const hotelId = req.user.hotel._id;
  
  // Verify hotel exists
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  // Read Excel file
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  
  const worksheet = workbook.getWorksheet('Rooms Template');
  if (!worksheet) {
    throw new AppError('Invalid template. Please use the provided template.', HTTP_STATUS.BAD_REQUEST);
  }

  const results = {
    success: [],
    errors: [],
    total: 0,
    successCount: 0,
    errorCount: 0
  };

  const roomsToCreate = [];
  const existingRoomNumbers = await Room.find({ hotel: hotelId }).select('roomNumber');
  const existingRoomNumbersSet = new Set(existingRoomNumbers.map(r => r.roomNumber.toUpperCase()));

  // Process rows (skip header and instruction rows)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return; // Skip header and instruction row

    results.total++;

    try {
      // Extract data
      const roomNumber = row.getCell(1).value?.toString().trim().toUpperCase();
      const roomType = row.getCell(2).value?.toString().trim().toLowerCase();
      const floor = parseInt(row.getCell(3).value);
      const basePrice = parseFloat(row.getCell(4).value);
      const hourlyRate = row.getCell(5).value ? parseFloat(row.getCell(5).value) : 0;
      const weekendPrice = row.getCell(6).value ? parseFloat(row.getCell(6).value) : null;
      const adultsCapacity = parseInt(row.getCell(7).value);
      const childrenCapacity = row.getCell(8).value ? parseInt(row.getCell(8).value) : 0;
      const extraAdultCharge = row.getCell(9).value ? parseFloat(row.getCell(9).value) : 0;
      const extraChildCharge = row.getCell(10).value ? parseFloat(row.getCell(10).value) : 0;
      const bedType = row.getCell(11).value?.toString().trim().toLowerCase() || 'double';
      const view = row.getCell(12).value?.toString().trim().toLowerCase() || 'none';
      const bathroom = row.getCell(13).value?.toString().trim().toLowerCase() || 'attached';
      const balcony = row.getCell(14).value?.toString().trim().toLowerCase() === 'yes';
      const smoking = row.getCell(15).value?.toString().trim().toLowerCase() === 'yes';
      const pets = row.getCell(16).value?.toString().trim().toLowerCase() === 'yes';
      const allowHourly = row.getCell(17).value?.toString().trim().toLowerCase() === 'yes';
      const description = row.getCell(18).value?.toString().trim() || '';
      const amenitiesStr = row.getCell(19).value?.toString().trim() || '';

      // Validation
      const errors = [];

      if (!roomNumber) errors.push('Room number is required');
      if (existingRoomNumbersSet.has(roomNumber)) errors.push(`Room ${roomNumber} already exists`);
      if (!roomType) errors.push('Room type is required');
      if (!Object.values(ROOM_TYPES).includes(roomType)) {
        errors.push(`Invalid room type. Must be one of: ${Object.values(ROOM_TYPES).join(', ')}`);
      }
      if (isNaN(floor)) errors.push('Floor must be a number');
      if (floor < 0) errors.push('Floor cannot be negative');
      if (isNaN(basePrice) || basePrice <= 0) errors.push('Base price must be a positive number');
      if (isNaN(adultsCapacity) || adultsCapacity < 1) errors.push('Adults capacity must be at least 1');

      if (errors.length > 0) {
        results.errors.push({
          row: rowNumber,
          roomNumber: roomNumber || 'N/A',
          errors
        });
        results.errorCount++;
        return;
      }

      // Parse amenities
      const amenities = amenitiesStr
        ? amenitiesStr.split(',').map(a => a.trim()).filter(Boolean)
        : [];

      // Create room object
      const roomData = {
        hotel: hotelId,
        roomNumber,
        roomType,
        floor,
        capacity: {
          adults: adultsCapacity,
          children: childrenCapacity
        },
        pricing: {
          basePrice,
          hourlyRate,
          weekendPrice,
          extraAdultCharge,
          extraChildCharge
        },
        features: {
          bedType,
          view,
          bathroom,
          balcony,
          smokingAllowed: smoking,
          petsAllowed: pets,
          allowHourlyBooking: allowHourly
        },
        description,
        amenities,
        status: ROOM_STATUS.AVAILABLE,
        createdBy: req.user._id
      };

      roomsToCreate.push(roomData);
      existingRoomNumbersSet.add(roomNumber); // Prevent duplicates within the file

      results.success.push({
        row: rowNumber,
        roomNumber
      });
      results.successCount++;

    } catch (error) {
      results.errors.push({
        row: rowNumber,
        roomNumber: 'N/A',
        errors: [error.message]
      });
      results.errorCount++;
    }
  });

  // Insert all valid rooms
  if (roomsToCreate.length > 0) {
    await Room.insertMany(roomsToCreate);
    
    // Update hotel's total rooms count
    hotel.totalRooms += roomsToCreate.length;
    await hotel.save();
  }

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    `Bulk upload completed. ${results.successCount} rooms created, ${results.errorCount} errors.`,
    results
  );
});

/**
 * 🔥 Get Bulk Upload Status/History
 * GET /api/rooms/bulk-upload/history
 */
export const getBulkUploadHistory = asyncHandler(async (req, res) => {
  const hotelId = req.user.hotel._id;
  
  // Get recently created rooms (last 100)
  const recentRooms = await Room.find({ 
    hotel: hotelId,
    createdBy: req.user._id 
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .select('roomNumber roomType floor pricing.basePrice createdAt');

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Bulk upload history fetched successfully',
    {
      recentRooms,
      count: recentRooms.length
    }
  );
});