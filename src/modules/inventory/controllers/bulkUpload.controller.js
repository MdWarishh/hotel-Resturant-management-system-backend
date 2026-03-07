// backend/src/modules/inventory/controllers/bulkUpload.controller.js

import ExcelJS from 'exceljs';
import InventoryItem from '../models/InventoryItem.model.js';
import StockTransaction from '../models/StockTransaction.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, INVENTORY_CATEGORIES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * Download Inventory Excel Template
 * GET /api/inventory/bulk-upload/template
 *
 * CHANGES:
 * - Columns reduced from 20 → 9 (only useful fields)
 * - Removed: SKU, Supplier Email, Storage Conditions, Expiry tracking, Shelf life, Reorder Point, Max Stock
 */
export const downloadInventoryTemplate = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inventory Template');

  // ✅ SIMPLIFIED: Only 9 columns instead of 20
  worksheet.columns = [
    { header: 'Item Name*', key: 'name', width: 25 },
    { header: 'Category*', key: 'category', width: 20 },
    { header: 'Unit*', key: 'unit', width: 12 },
    { header: 'Current Stock', key: 'currentStock', width: 15 },
    { header: 'Minimum Stock', key: 'minimumStock', width: 15 },
    { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
    { header: 'Supplier Name', key: 'supplierName', width: 25 },
    { header: 'Storage Location', key: 'storageLocation', width: 20 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0EA5E9' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  worksheet.getRow(1).height = 30;

  // Instruction row
  const instructionRow = worksheet.addRow({
    name: 'e.g., Basmati Rice',
    category: 'food / beverage / linen / toiletries / cleaning / amenities / other',
    unit: 'kg / g / l / ml / pcs / box / packet / bottle / can',
    currentStock: '50',
    minimumStock: '10 (optional)',
    purchasePrice: '120.50 (optional)',
    supplierName: 'ABC Traders (optional)',
    storageLocation: 'Store Room A (optional)',
    notes: 'Any notes (optional)',
  });
  instructionRow.font = { italic: true, color: { argb: '64748B' } };
  instructionRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F1F5F9' }
  };

  // Sample data rows
  worksheet.addRow({
    name: 'Basmati Rice',
    category: 'food',
    unit: 'kg',
    currentStock: 50,
    minimumStock: 10,
    purchasePrice: 120,
    supplierName: 'Rice Traders Ltd',
    storageLocation: 'Dry Store',
    notes: 'Store in cool, dry place',
  });

  worksheet.addRow({
    name: 'Fresh Milk',
    category: 'beverage',
    unit: 'l',
    currentStock: 20,
    minimumStock: 5,
    purchasePrice: 60,
    supplierName: 'Mother Dairy',
    storageLocation: 'Kitchen Fridge',
    notes: '',
  });

  worksheet.addRow({
    name: 'Bath Towels',
    category: 'linen',
    unit: 'pcs',
    currentStock: 100,
    minimumStock: 30,
    purchasePrice: 250,
    supplierName: 'Textile House',
    storageLocation: 'Linen Room',
    notes: '',
  });

  worksheet.addRow({
    name: 'Shampoo Bottles',
    category: 'toiletries',
    unit: 'bottle',
    currentStock: 200,
    minimumStock: 50,
    purchasePrice: 15,
    supplierName: 'Amenities Supplier',
    storageLocation: 'Housekeeping Store',
    notes: '',
  });

  worksheet.addRow({
    name: 'Floor Cleaner',
    category: 'cleaning',
    unit: 'l',
    currentStock: 30,
    minimumStock: 10,
    purchasePrice: 180,
    supplierName: 'Cleaning Solutions',
    storageLocation: 'Housekeeping Store',
    notes: 'Dilute before use',
  });

  // Add borders
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'CBD5E1' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } },
      };
    });
  });

  // Instructions sheet
  const notesSheet = workbook.addWorksheet('Instructions');
  notesSheet.columns = [
    { header: 'Field', key: 'field', width: 20 },
    { header: 'Required?', key: 'required', width: 12 },
    { header: 'Valid Values / Notes', key: 'values', width: 60 },
  ];

  notesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  notesSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0EA5E9' }
  };

  const instructions = [
    { field: 'Item Name', required: 'YES', values: 'Name of the item (min 2 characters). If duplicate name found in file, later row is skipped.' },
    { field: 'Category', required: 'YES', values: 'food, beverage, linen, toiletries, cleaning, amenities, other' },
    { field: 'Unit', required: 'YES', values: 'kg, g, l, ml, pcs, box, packet, bottle, can' },
    { field: 'Current Stock', required: 'No', values: 'Current quantity (number). Defaults to 0 if empty.' },
    { field: 'Minimum Stock', required: 'No', values: 'Minimum stock level for low-stock alerts. Defaults to 0.' },
    { field: 'Purchase Price', required: 'No', values: 'Cost per unit in rupees. Can be added later.' },
    { field: 'Supplier Name', required: 'No', values: 'Name of supplier/vendor. Can be added later.' },
    { field: 'Storage Location', required: 'No', values: 'Where item is stored. e.g., Store Room A, Kitchen Fridge.' },
    { field: 'Notes', required: 'No', values: 'Any extra notes.' },
  ];

  instructions.forEach(inst => notesSheet.addRow(inst));

  notesSheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=Inventory_Upload_Template.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * Upload and Process Inventory Excel File
 * POST /api/inventory/bulk-upload
 *
 * CHANGES:
 * - Duplicate item name: SKIP silently with a warning (don't block others)
 * - Empty fields: allowed — defaults applied where needed
 * - purchasePrice: optional now (defaults to 0)
 * - unit: if invalid/empty → defaults to 'pcs' instead of erroring
 * - category: if invalid/empty → defaults to 'other' instead of erroring
 * - storageConditions: removed strict validation
 */
export const bulkUploadInventory = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Please upload an Excel file', HTTP_STATUS.BAD_REQUEST);
  }

  const hotelId = req.user.hotel._id;

  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new AppError('Hotel not found', HTTP_STATUS.NOT_FOUND);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);

  const worksheet = workbook.getWorksheet('Inventory Template');
  if (!worksheet) {
    throw new AppError('Invalid template. Please use the provided template.', HTTP_STATUS.BAD_REQUEST);
  }

  const results = {
    success: [],
    errors: [],
    skipped: [],
    total: 0,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
  };

  const itemsToCreate = [];
  const transactionsToCreate = [];

  // ✅ Fetch existing names to detect duplicates (but don't block — just skip)
  const existingNames = await InventoryItem.find({ hotel: hotelId }).select('name');
  const existingNamesSet = new Set(existingNames.map(item => item.name.toLowerCase().trim()));

  const validCategories = Object.values(INVENTORY_CATEGORIES);
  const validUnits = ['kg', 'g', 'l', 'ml', 'pcs', 'box', 'packet', 'bottle', 'can'];

  // Process rows (skip header row 1 and instruction row 2)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;

    // Skip fully empty rows
    const rowValues = row.values.filter(v => v !== null && v !== undefined && v !== '');
    if (rowValues.length === 0) return;

    results.total++;

    try {
      // Extract values from 9-column template
      const name = row.getCell(1).value?.toString().trim();
      const rawCategory = row.getCell(2).value?.toString().trim().toLowerCase() || '';
      const rawUnit = row.getCell(3).value?.toString().trim().toLowerCase() || '';
      const currentStock = parseFloat(row.getCell(4).value) || 0;
      const minimumStock = parseFloat(row.getCell(5).value) || 0;
      const purchasePrice = parseFloat(row.getCell(6).value) || 0;  // ✅ Default 0, not error
      const supplierName = row.getCell(7).value?.toString().trim() || '';
      const storageLocation = row.getCell(8).value?.toString().trim() || '';
      const notes = row.getCell(9).value?.toString().trim() || '';

      const errors = [];

      // ✅ Only 3 truly required fields: name, category, unit
      if (!name || name.length < 2) {
        errors.push('Item name is required (min 2 characters)');
      }

      if (!rawCategory) {
        errors.push('Category is required');
      }

      if (!rawUnit) {
        errors.push('Unit is required');
      }

      if (errors.length > 0) {
        results.errors.push({ row: rowNumber, itemName: name || 'N/A', errors });
        results.errorCount++;
        return;
      }

      // ✅ Duplicate name: SKIP with warning, don't block other rows
      const normalizedName = name.toLowerCase().trim();
      if (existingNamesSet.has(normalizedName)) {
        results.skipped.push({
          row: rowNumber,
          itemName: name,
          reason: `"${name}" already exists in inventory — skipped`,
        });
        results.skippedCount++;
        return;
      }
      existingNamesSet.add(normalizedName); // prevent duplicates within same file

      // ✅ Category: if invalid value entered, default to 'other'
      const category = validCategories.includes(rawCategory) ? rawCategory : 'other';

      // ✅ Unit: if invalid value entered, default to 'pcs'
      const unit = validUnits.includes(rawUnit) ? rawUnit : 'pcs';

      const itemData = {
        hotel: hotelId,
        name,
        category,
        unit,
        quantity: {
          current: currentStock,
          minimum: minimumStock,
          maximum: null,
        },
        pricing: {
          purchasePrice,
          sellingPrice: null,
          currency: 'INR',
        },
        supplier: {
          name: supplierName,
          contact: '',
          email: '',
        },
        storage: {
          location: storageLocation,
          conditions: 'room-temp',
        },
        expiryTracking: {
          enabled: false,
          expiryDate: null,
          shelfLife: null,
        },
        reorderPoint: minimumStock,
        lastRestocked: currentStock > 0 ? new Date() : null,
        notes,
        createdBy: req.user._id,
      };

      itemsToCreate.push(itemData);
      results.success.push({ row: rowNumber, itemName: name });
      results.successCount++;

    } catch (error) {
      results.errors.push({
        row: rowNumber,
        itemName: 'N/A',
        errors: [error.message],
      });
      results.errorCount++;
    }
  });

  // Insert valid items
  if (itemsToCreate.length > 0) {
    const createdItems = await InventoryItem.insertMany(itemsToCreate, { ordered: false });

    for (const item of createdItems) {
      if (item.quantity.current > 0) {
        transactionsToCreate.push({
          hotel: hotelId,
          inventoryItem: item._id,
          transactionType: 'purchase',
          quantity: item.quantity.current,
          unit: item.unit,
          previousStock: 0,
          newStock: item.quantity.current,
          cost: {
            unitPrice: item.pricing.purchasePrice,
            totalPrice: item.pricing.purchasePrice * item.quantity.current,
          },
          reference: { type: 'manual' },
          reason: 'Initial stock from bulk upload',
          performedBy: req.user._id,
        });
      }
    }

    if (transactionsToCreate.length > 0) {
      await StockTransaction.insertMany(transactionsToCreate, { ordered: false });
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    `Bulk upload completed. ${results.successCount} items created, ${results.skippedCount} skipped (duplicates), ${results.errorCount} errors.`,
    results
  );
});