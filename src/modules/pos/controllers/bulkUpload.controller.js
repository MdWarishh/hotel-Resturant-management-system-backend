// backend/src/modules/pos/controllers/bulkUpload.controller.js

import ExcelJS from 'exceljs';
import MenuItem from '../models/MenuItem.model.js';
import MenuCategory from '../models/MenuCategory.model.js';
import MenuSubCategory from '../models/MenuSubCategory.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';

/**
 * 🔥 Download Menu Items Excel Template
 * GET /api/pos/bulk-upload/template
 */
export const downloadMenuTemplate = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Menu Items');

  // Define columns
  worksheet.columns = [
    { header: 'Item Name*', key: 'name', width: 30 },
    { header: 'Category*', key: 'category', width: 20 },
    { header: 'Sub-Category', key: 'subCategory', width: 20 },
    { header: 'Price*', key: 'price', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Cuisine', key: 'cuisine', width: 15 },
    { header: 'Spicy Level', key: 'spicyLevel', width: 15 },
    { header: 'Prep Time (min)', key: 'prepTime', width: 15 },
    { header: 'Tags (comma-separated)', key: 'tags', width: 30 },
    { header: 'Available (Yes/No)', key: 'isAvailable', width: 18 },
    { header: 'Display Order', key: 'displayOrder', width: 15 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '00ADB5' } // Teal
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  worksheet.getRow(1).height = 30;

  // Add instruction row
  const instructionRow = worksheet.addRow({
    name: 'Item name here',
    category: 'Starters/Main Course/Desserts/Beverages',
    subCategory: 'Veg/Non-veg/Hot/Cold (optional)',
    price: '250',
    description: 'Item description...',
    type: 'veg/non-veg/vegan/beverage',
    cuisine: 'indian/chinese/continental/italian/mexican/thai/other',
    spicyLevel: 'none/mild/medium/hot/extra-hot',
    prepTime: '15',
    tags: 'popular, chef-special, best-seller',
    isAvailable: 'Yes or No',
    displayOrder: '0',
  });
  instructionRow.font = { italic: true, color: { argb: '64748B' } };
  instructionRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F1F5F9' }
  };

  // Sample data - Starters
  worksheet.addRow({
    name: 'Paneer Tikka',
    category: 'Starters',
    subCategory: 'Veg Starters',
    price: 250,
    description: 'Cottage cheese cubes marinated in spices and grilled',
    type: 'veg',
    cuisine: 'indian',
    spicyLevel: 'medium',
    prepTime: 15,
    tags: 'popular, chef-special',
    isAvailable: 'Yes',
    displayOrder: 1,
  });

  worksheet.addRow({
    name: 'Chicken Tikka',
    category: 'Starters',
    subCategory: 'Non-veg Starters',
    price: 280,
    description: 'Tender chicken pieces marinated and grilled',
    type: 'non-veg',
    cuisine: 'indian',
    spicyLevel: 'hot',
    prepTime: 20,
    tags: 'popular, spicy',
    isAvailable: 'Yes',
    displayOrder: 2,
  });

  // Sample data - Main Course
  worksheet.addRow({
    name: 'Dal Makhani',
    category: 'Main Course',
    subCategory: 'Veg Main Course',
    price: 200,
    description: 'Creamy black lentils cooked overnight',
    type: 'veg',
    cuisine: 'indian',
    spicyLevel: 'mild',
    prepTime: 25,
    tags: 'authentic, creamy',
    isAvailable: 'Yes',
    displayOrder: 1,
  });

  worksheet.addRow({
    name: 'Butter Chicken',
    category: 'Main Course',
    subCategory: 'Non-veg Main Course',
    price: 320,
    description: 'Tender chicken in rich tomato gravy',
    type: 'non-veg',
    cuisine: 'indian',
    spicyLevel: 'medium',
    prepTime: 30,
    tags: 'popular, chef-special, creamy',
    isAvailable: 'Yes',
    displayOrder: 2,
  });

  // Sample data - Beverages
  worksheet.addRow({
    name: 'Mango Lassi',
    category: 'Beverages',
    subCategory: 'Cold Drinks',
    price: 80,
    description: 'Fresh mango yogurt drink',
    type: 'beverage',
    cuisine: 'indian',
    spicyLevel: 'none',
    prepTime: 5,
    tags: 'refreshing, sweet',
    isAvailable: 'Yes',
    displayOrder: 1,
  });

  worksheet.addRow({
    name: 'Masala Chai',
    category: 'Beverages',
    subCategory: 'Hot Drinks',
    price: 40,
    description: 'Indian spiced tea',
    type: 'beverage',
    cuisine: 'indian',
    spicyLevel: 'mild',
    prepTime: 5,
    tags: 'traditional, hot',
    isAvailable: 'Yes',
    displayOrder: 2,
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
  const notesSheet = workbook.addWorksheet('Instructions');
  notesSheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Required?', key: 'required', width: 12 },
    { header: 'Valid Values / Notes', key: 'values', width: 60 },
  ];

  notesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  notesSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '00ADB5' }
  };

  const instructions = [
    { field: 'Item Name', required: 'Yes', values: 'Name of the menu item (2-100 characters)' },
    { field: 'Category', required: 'Yes', values: 'Main category name (e.g., Starters, Main Course, Desserts, Beverages) - Will be auto-created if doesn\'t exist' },
    { field: 'Sub-Category', required: 'No', values: 'Sub-category name (e.g., Veg Starters, Non-veg Starters) - Will be auto-created under category if doesn\'t exist' },
    { field: 'Price', required: 'Yes', values: 'Item price in rupees (number, e.g., 250)' },
    { field: 'Description', required: 'No', values: 'Item description (max 500 characters)' },
    { field: 'Type', required: 'No', values: 'veg, non-veg, vegan, beverage (default: veg)' },
    { field: 'Cuisine', required: 'No', values: 'indian, chinese, continental, italian, mexican, thai, other (default: indian)' },
    { field: 'Spicy Level', required: 'No', values: 'none, mild, medium, hot, extra-hot (default: none)' },
    { field: 'Prep Time', required: 'No', values: 'Preparation time in minutes (number, default: 15)' },
    { field: 'Tags', required: 'No', values: 'Comma-separated tags (e.g., popular, chef-special, spicy)' },
    { field: 'Available', required: 'No', values: 'Yes or No (default: Yes) - Item availability status' },
    { field: 'Display Order', required: 'No', values: 'Number for sorting (default: 0) - Lower numbers appear first' },
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
    'attachment; filename=Menu_Items_Upload_Template.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * 🔥 Upload and Process Menu Items Excel File
 * POST /api/pos/bulk-upload
 */
export const bulkUploadMenuItems = asyncHandler(async (req, res) => {
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

  const worksheet = workbook.getWorksheet('Menu Items');
  if (!worksheet) {
    throw new AppError('Invalid template. Please use the provided template.', HTTP_STATUS.BAD_REQUEST);
  }

  const results = {
    success: [],
    errors: [],
    total: 0,
    successCount: 0,
    errorCount: 0,
    categoriesCreated: 0,
    subCategoriesCreated: 0
  };

  const itemsToCreate = [];
  
  // Cache for categories and subcategories
  const categoryCache = {};
  const subCategoryCache = {};

  // Get existing items to check duplicates
  const existingItems = await MenuItem.find({ hotel: hotelId }).select('name category');
  const existingItemsSet = new Set(
    existingItems.map(item => `${item.name.toLowerCase().trim()}-${item.category.toString()}`)
  );

  // Valid enums
  const validTypes = ['veg', 'non-veg', 'vegan', 'beverage'];
  const validCuisines = ['indian', 'chinese', 'continental', 'italian', 'mexican', 'thai', 'other'];
  const validSpicyLevels = ['none', 'mild', 'medium', 'hot', 'extra-hot'];

  // Helper: Get or create category
  const getOrCreateCategory = async (categoryName) => {
    const normalizedName = categoryName.trim();
    
    if (categoryCache[normalizedName]) {
      return categoryCache[normalizedName];
    }

    let category = await MenuCategory.findOne({
      hotel: hotelId,
      name: normalizedName
    });

    if (!category) {
      category = await MenuCategory.create({
        hotel: hotelId,
        name: normalizedName,
        displayOrder: Object.keys(categoryCache).length,
        createdBy: req.user._id
      });
      results.categoriesCreated++;
    }

    categoryCache[normalizedName] = category;
    return category;
  };

  // Helper: Get or create sub-category
  const getOrCreateSubCategory = async (subCategoryName, categoryId) => {
    const normalizedName = subCategoryName.trim();
    const cacheKey = `${categoryId}-${normalizedName}`;

    if (subCategoryCache[cacheKey]) {
      return subCategoryCache[cacheKey];
    }

    let subCategory = await MenuSubCategory.findOne({
      hotel: hotelId,
      category: categoryId,
      name: normalizedName
    });

    if (!subCategory) {
      subCategory = await MenuSubCategory.create({
        hotel: hotelId,
        category: categoryId,
        name: normalizedName,
        displayOrder: Object.keys(subCategoryCache).length,
        createdBy: req.user._id
      });
      results.subCategoriesCreated++;
    }

    subCategoryCache[cacheKey] = subCategory;
    return subCategory;
  };

  // Process rows (skip header and instruction rows)
  for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    
    // Skip empty rows
    if (!row.getCell(1).value) continue;

    results.total++;

    try {
      // Extract data
      const name = row.getCell(1).value?.toString().trim();
      const categoryName = row.getCell(2).value?.toString().trim();
      const subCategoryName = row.getCell(3).value?.toString().trim() || null;
      const price = parseFloat(row.getCell(4).value);
      const description = row.getCell(5).value?.toString().trim() || '';
      const type = row.getCell(6).value?.toString().trim().toLowerCase() || 'veg';
      const cuisine = row.getCell(7).value?.toString().trim().toLowerCase() || 'indian';
      const spicyLevel = row.getCell(8).value?.toString().trim().toLowerCase() || 'none';
      const prepTime = row.getCell(9).value ? parseInt(row.getCell(9).value) : 15;
      const tagsStr = row.getCell(10).value?.toString().trim() || '';
      const isAvailableStr = row.getCell(11).value?.toString().trim().toLowerCase() || 'yes';
      const displayOrder = row.getCell(12).value ? parseInt(row.getCell(12).value) : 0;

      // Validation
      const errors = [];

      if (!name || name.length < 2) errors.push('Item name required (min 2 characters)');
      if (!categoryName) errors.push('Category is required');
      if (isNaN(price) || price <= 0) errors.push('Valid price is required');
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be: ${validTypes.join(', ')}`);
      }
      if (!validCuisines.includes(cuisine)) {
        errors.push(`Invalid cuisine. Must be: ${validCuisines.join(', ')}`);
      }
      if (!validSpicyLevels.includes(spicyLevel)) {
        errors.push(`Invalid spicy level. Must be: ${validSpicyLevels.join(', ')}`);
      }

      // Get or create category
      const category = await getOrCreateCategory(categoryName);
      
      // Check duplicate
      const itemKey = `${name.toLowerCase().trim()}-${category._id.toString()}`;
      if (existingItemsSet.has(itemKey)) {
        errors.push(`Item "${name}" already exists in "${categoryName}"`);
      } else {
        existingItemsSet.add(itemKey);
      }

      if (errors.length > 0) {
        results.errors.push({
          row: rowNumber,
          itemName: name || 'N/A',
          category: categoryName || 'N/A',
          errors
        });
        results.errorCount++;
        continue;
      }

      // Get or create sub-category if provided
      let subCategoryId = null;
      if (subCategoryName) {
        const subCategory = await getOrCreateSubCategory(subCategoryName, category._id);
        subCategoryId = subCategory._id;
      }

      // Parse tags
      const tags = tagsStr
        ? tagsStr.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      // Is available
      const isAvailable = isAvailableStr === 'yes' || isAvailableStr === 'true' || isAvailableStr === '1';

      // Create item object
      const itemData = {
        hotel: hotelId,
        category: category._id,
        subCategory: subCategoryId,
        name,
        description,
        price,
        type,
        cuisine,
        spicyLevel,
        preparationTime: prepTime,
        tags,
        isAvailable,
        displayOrder,
        createdBy: req.user._id
      };

      itemsToCreate.push(itemData);

      results.success.push({
        row: rowNumber,
        itemName: name,
        category: categoryName,
        subCategory: subCategoryName || '-'
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
  }

  // Insert all valid items
  if (itemsToCreate.length > 0) {
    await MenuItem.insertMany(itemsToCreate, { ordered: false });
  }

  return successResponse(
    res,
    HTTP_STATUS.CREATED,
    `Bulk upload completed. ${results.successCount} items created, ${results.categoriesCreated} categories created, ${results.subCategoriesCreated} sub-categories created, ${results.errorCount} errors.`,
    results
  );
});