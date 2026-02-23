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
 * 🔥 Download Inventory Excel Template
 * GET /api/inventory/bulk-upload/template
 */
export const downloadInventoryTemplate = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inventory Template');

  // Define columns
  worksheet.columns = [
    { header: 'Item Name*', key: 'name', width: 25 },
    { header: 'Category*', key: 'category', width: 20 },
    { header: 'SKU', key: 'sku', width: 15 },
    { header: 'Description', key: 'description', width: 35 },
    { header: 'Unit*', key: 'unit', width: 12 },
    { header: 'Current Stock*', key: 'currentStock', width: 15 },
    { header: 'Minimum Stock*', key: 'minimumStock', width: 15 },
    { header: 'Maximum Stock', key: 'maximumStock', width: 15 },
    { header: 'Reorder Point', key: 'reorderPoint', width: 15 },
    { header: 'Purchase Price*', key: 'purchasePrice', width: 15 },
    { header: 'Selling Price', key: 'sellingPrice', width: 15 },
    { header: 'Supplier Name', key: 'supplierName', width: 25 },
    { header: 'Supplier Contact', key: 'supplierContact', width: 15 },
    { header: 'Supplier Email', key: 'supplierEmail', width: 25 },
    { header: 'Storage Location', key: 'storageLocation', width: 20 },
    { header: 'Storage Conditions', key: 'storageConditions', width: 18 },
    { header: 'Expiry Tracking (Yes/No)', key: 'expiryTracking', width: 20 },
    { header: 'Expiry Date (YYYY-MM-DD)', key: 'expiryDate', width: 20 },
    { header: 'Shelf Life (Days)', key: 'shelfLife', width: 15 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0EA5E9' } // Sky blue
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  worksheet.getRow(1).height = 30;

  // Add instruction row
  const instructionRow = worksheet.addRow({
    name: 'e.g., Basmati Rice',
    category: 'food/beverage/linen/toiletries/cleaning/amenities/other',
    sku: 'RICE-001 (optional, unique)',
    description: 'Premium quality basmati rice',
    unit: 'kg/g/l/ml/pcs/box/packet/bottle/can',
    currentStock: '50',
    minimumStock: '10',
    maximumStock: '100 (optional)',
    reorderPoint: '15 (auto = min stock)',
    purchasePrice: '120.50',
    sellingPrice: '150 (optional)',
    supplierName: 'ABC Traders',
    supplierContact: '9876543210',
    supplierEmail: 'supplier@email.com',
    storageLocation: 'Store Room A',
    storageConditions: 'room-temp/refrigerated/frozen/dry/cool',
    expiryTracking: 'Yes or No',
    expiryDate: '2025-12-31',
    shelfLife: '365',
    notes: 'Any additional notes'
  });
  instructionRow.font = { italic: true, color: { argb: '64748B' } };
  instructionRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F1F5F9' }
  };

  // Add sample data - Restaurant Items
  worksheet.addRow({
    name: 'Basmati Rice',
    category: 'food',
    sku: 'FOOD-001',
    description: 'Premium quality basmati rice for biryani',
    unit: 'kg',
    currentStock: 50,
    minimumStock: 10,
    maximumStock: 100,
    reorderPoint: 15,
    purchasePrice: 120,
    sellingPrice: 150,
    supplierName: 'Rice Traders Ltd',
    supplierContact: '9876543210',
    supplierEmail: 'rice@traders.com',
    storageLocation: 'Dry Store',
    storageConditions: 'dry',
    expiryTracking: 'No',
    expiryDate: '',
    shelfLife: '',
    notes: 'Store in cool, dry place'
  });

  worksheet.addRow({
    name: 'Fresh Milk',
    category: 'beverage',
    sku: 'BEV-001',
    description: 'Fresh dairy milk',
    unit: 'l',
    currentStock: 20,
    minimumStock: 5,
    maximumStock: 50,
    reorderPoint: 8,
    purchasePrice: 60,
    sellingPrice: 80,
    supplierName: 'Mother Dairy',
    supplierContact: '9876543211',
    supplierEmail: 'milk@dairy.com',
    storageLocation: 'Kitchen Fridge',
    storageConditions: 'refrigerated',
    expiryTracking: 'Yes',
    expiryDate: '2026-03-15',
    shelfLife: 7,
    notes: 'Use within 3 days of opening'
  });

  // Add sample data - Hotel Items
  worksheet.addRow({
    name: 'Bath Towels',
    category: 'linen',
    sku: 'LINEN-001',
    description: 'White cotton bath towels',
    unit: 'pcs',
    currentStock: 100,
    minimumStock: 30,
    maximumStock: 200,
    reorderPoint: 40,
    purchasePrice: 250,
    sellingPrice: null,
    supplierName: 'Textile House',
    supplierContact: '9876543212',
    supplierEmail: 'textile@house.com',
    storageLocation: 'Linen Room',
    storageConditions: 'dry',
    expiryTracking: 'No',
    expiryDate: '',
    shelfLife: '',
    notes: 'Standard hotel quality'
  });

  worksheet.addRow({
    name: 'Shampoo Bottles',
    category: 'toiletries',
    sku: 'TOI-001',
    description: 'Guest room shampoo 30ml bottles',
    unit: 'bottle',
    currentStock: 200,
    minimumStock: 50,
    maximumStock: 500,
    reorderPoint: 75,
    purchasePrice: 15,
    sellingPrice: null,
    supplierName: 'Amenities Supplier',
    supplierContact: '9876543213',
    supplierEmail: 'amenities@supplier.com',
    storageLocation: 'Housekeeping Store',
    storageConditions: 'room-temp',
    expiryTracking: 'Yes',
    expiryDate: '2027-06-30',
    shelfLife: 730,
    notes: 'Herbal fragrance'
  });

  worksheet.addRow({
    name: 'Floor Cleaner',
    category: 'cleaning',
    sku: 'CLEAN-001',
    description: 'Multipurpose floor cleaning liquid',
    unit: 'l',
    currentStock: 30,
    minimumStock: 10,
    maximumStock: 60,
    reorderPoint: 15,
    purchasePrice: 180,
    sellingPrice: null,
    supplierName: 'Cleaning Solutions',
    supplierContact: '9876543214',
    supplierEmail: 'clean@solutions.com',
    storageLocation: 'Housekeeping Store',
    storageConditions: 'room-temp',
    expiryTracking: 'No',
    expiryDate: '',
    shelfLife: '',
    notes: 'Dilute before use'
  });

  // Add borders
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'CBD5E1' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    });
  });

  // Add notes sheet
  const notesSheet = workbook.addWorksheet('Instructions & Valid Values');
  notesSheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
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
    { field: 'Item Name', required: 'Yes', values: 'Name of the inventory item (2-100 characters)' },
    { field: 'Category', required: 'Yes', values: 'food, beverage, linen, toiletries, cleaning, amenities, other' },
    { field: 'SKU', required: 'No', values: 'Stock Keeping Unit - unique code (e.g., FOOD-001)' },
    { field: 'Description', required: 'No', values: 'Detailed description (max 500 characters)' },
    { field: 'Unit', required: 'Yes', values: 'kg, g, l, ml, pcs, box, packet, bottle, can' },
    { field: 'Current Stock', required: 'Yes', values: 'Current quantity in stock (number, min 0)' },
    { field: 'Minimum Stock', required: 'Yes', values: 'Minimum stock level for alerts (number, min 0)' },
    { field: 'Maximum Stock', required: 'No', values: 'Maximum stock capacity (number, optional)' },
    { field: 'Reorder Point', required: 'No', values: 'Stock level to trigger reorder (defaults to minimum stock)' },
    { field: 'Purchase Price', required: 'Yes', values: 'Cost per unit in rupees (number, min 0)' },
    { field: 'Selling Price', required: 'No', values: 'Selling price per unit (optional, for POS items)' },
    { field: 'Supplier Name', required: 'No', values: 'Name of the supplier/vendor' },
    { field: 'Supplier Contact', required: 'No', values: 'Supplier phone number' },
    { field: 'Supplier Email', required: 'No', values: 'Supplier email address' },
    { field: 'Storage Location', required: 'No', values: 'Where the item is stored (e.g., Store Room A, Kitchen)' },
    { field: 'Storage Conditions', required: 'No', values: 'room-temp, refrigerated, frozen, dry, cool' },
    { field: 'Expiry Tracking', required: 'No', values: 'Yes or No (enables expiry date tracking)' },
    { field: 'Expiry Date', required: 'No', values: 'Format: YYYY-MM-DD (e.g., 2025-12-31) - only if expiry tracking is Yes' },
    { field: 'Shelf Life', required: 'No', values: 'Number of days the item lasts (e.g., 365)' },
    { field: 'Notes', required: 'No', values: 'Any additional notes or instructions (max 500 characters)' },
  ];

  instructions.forEach(inst => notesSheet.addRow(inst));

  // Style notes sheet
  notesSheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

  // Set response headers
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
 * 🔥 Upload and Process Inventory Excel File
 * POST /api/inventory/bulk-upload
 */
export const bulkUploadInventory = asyncHandler(async (req, res) => {
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

  const worksheet = workbook.getWorksheet('Inventory Template');
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

  const itemsToCreate = [];
  const transactionsToCreate = [];
  const existingSKUs = await InventoryItem.find({ hotel: hotelId, sku: { $ne: null } }).select('sku');
  const existingSKUSet = new Set(existingSKUs.map(item => item.sku.toUpperCase()));

  // 🔥 Also check for existing item names to prevent duplicates
  const existingNames = await InventoryItem.find({ hotel: hotelId }).select('name');
  const existingNamesSet = new Set(existingNames.map(item => item.name.toLowerCase().trim()));

  // Valid values
  const validCategories = Object.values(INVENTORY_CATEGORIES);
  const validUnits = ['kg', 'g', 'l', 'ml', 'pcs', 'box', 'packet', 'bottle', 'can'];
  const validStorageConditions = ['room-temp', 'refrigerated', 'frozen', 'dry', 'cool'];

  // Process rows (skip header and instruction rows)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;

    results.total++;

    try {
      // Extract data
      const name = row.getCell(1).value?.toString().trim();
      const category = row.getCell(2).value?.toString().trim().toLowerCase();
      const sku = row.getCell(3).value?.toString().trim().toUpperCase() || null;
      const description = row.getCell(4).value?.toString().trim() || '';
      const unit = row.getCell(5).value?.toString().trim().toLowerCase();
      const currentStock = parseFloat(row.getCell(6).value) || 0;
      const minimumStock = parseFloat(row.getCell(7).value) || 0;
      const maximumStock = row.getCell(8).value ? parseFloat(row.getCell(8).value) : null;
      const reorderPoint = row.getCell(9).value ? parseFloat(row.getCell(9).value) : minimumStock;
      const purchasePrice = parseFloat(row.getCell(10).value);
      const sellingPrice = row.getCell(11).value ? parseFloat(row.getCell(11).value) : null;
      const supplierName = row.getCell(12).value?.toString().trim() || '';
      const supplierContact = row.getCell(13).value?.toString().trim() || '';
      const supplierEmail = row.getCell(14).value?.toString().trim() || '';
      const storageLocation = row.getCell(15).value?.toString().trim() || '';
      const storageConditions = row.getCell(16).value?.toString().trim().toLowerCase() || 'room-temp';
      const expiryTracking = row.getCell(17).value?.toString().trim().toLowerCase() === 'yes';
      const expiryDateStr = row.getCell(18).value?.toString().trim() || '';
      const shelfLife = row.getCell(19).value ? parseInt(row.getCell(19).value) : null;
      const notes = row.getCell(20).value?.toString().trim() || '';

      // Validation
      const errors = [];

      if (!name || name.length < 2) errors.push('Item name required (min 2 characters)');
      
      // 🔥 Check for duplicate item name
      const normalizedName = name.toLowerCase().trim();
      if (existingNamesSet.has(normalizedName)) {
        errors.push(`Item "${name}" already exists in inventory`);
      } else {
        existingNamesSet.add(normalizedName); // Prevent duplicates within file
      }
      
      if (!category) errors.push('Category is required');
      if (category && !validCategories.includes(category)) {
        errors.push(`Invalid category. Must be: ${validCategories.join(', ')}`);
      }
      if (sku && existingSKUSet.has(sku)) errors.push(`SKU ${sku} already exists`);
      if (sku) existingSKUSet.add(sku); // Prevent duplicates in file
      if (!unit) errors.push('Unit is required');
      if (unit && !validUnits.includes(unit)) {
        errors.push(`Invalid unit. Must be: ${validUnits.join(', ')}`);
      }
      if (isNaN(currentStock) || currentStock < 0) errors.push('Current stock must be >= 0');
      if (isNaN(minimumStock) || minimumStock < 0) errors.push('Minimum stock must be >= 0');
      if (isNaN(purchasePrice) || purchasePrice < 0) errors.push('Purchase price must be >= 0');
      if (storageConditions && !validStorageConditions.includes(storageConditions)) {
        errors.push(`Invalid storage conditions. Must be: ${validStorageConditions.join(', ')}`);
      }

      // Parse expiry date
      let expiryDate = null;
      if (expiryTracking && expiryDateStr) {
        expiryDate = new Date(expiryDateStr);
        if (isNaN(expiryDate.getTime())) {
          errors.push('Invalid expiry date format. Use YYYY-MM-DD');
        }
      }

      if (errors.length > 0) {
        results.errors.push({
          row: rowNumber,
          itemName: name || 'N/A',
          errors
        });
        results.errorCount++;
        return;
      }

      // Create item object
      const itemData = {
        hotel: hotelId,
        name,
        category,
        sku: sku || undefined,
        description,
        unit,
        quantity: {
          current: currentStock,
          minimum: minimumStock,
          maximum: maximumStock
        },
        pricing: {
          purchasePrice,
          sellingPrice,
          currency: 'INR'
        },
        supplier: {
          name: supplierName,
          contact: supplierContact,
          email: supplierEmail
        },
        storage: {
          location: storageLocation,
          conditions: storageConditions
        },
        expiryTracking: {
          enabled: expiryTracking,
          expiryDate: expiryDate,
          shelfLife: shelfLife
        },
        reorderPoint,
        lastRestocked: currentStock > 0 ? new Date() : null,
        notes,
        createdBy: req.user._id
      };

      itemsToCreate.push(itemData);

      results.success.push({
        row: rowNumber,
        itemName: name
      });
      results.successCount++;

    } catch (error) {
      results.errors.push({
        row: rowNumber,
        itemName: 'N/A',
        errors: [error.message]
      });
      results.errorCount++;
    }
  });

  // Insert all valid items
  if (itemsToCreate.length > 0) {
    const createdItems = await InventoryItem.insertMany(itemsToCreate, { ordered: false });

    // Create initial stock transactions for items with stock
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
            totalPrice: item.pricing.purchasePrice * item.quantity.current
          },
          reference: {
            type: 'manual'  // ✅ Changed from 'bulk-upload' to 'manual'
          },
          reason: 'Initial stock from bulk upload',
          performedBy: req.user._id
        });
      }
    }

    // Insert all transactions
    if (transactionsToCreate.length > 0) {
      await StockTransaction.insertMany(transactionsToCreate, { ordered: false });
    }
  }

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    `Bulk upload completed. ${results.successCount} items created, ${results.errorCount} errors.`,
    results
  );
});