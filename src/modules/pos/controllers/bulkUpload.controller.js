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
 * Download Menu Items Excel Template
 * GET /api/pos/bulk-upload/template
 *
 * CHANGES:
 * - Removed strict required markers from optional fields
 * - Template info updated to reflect relaxed validation
 */
export const downloadMenuTemplate = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Menu Items');

  worksheet.columns = [
    { header: 'Item Name*', key: 'name', width: 30 },
    { header: 'Category*', key: 'category', width: 20 },
    { header: 'Price*', key: 'price', width: 12 },
    { header: 'Sub-Category', key: 'subCategory', width: 20 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Cuisine', key: 'cuisine', width: 15 },
    { header: 'Spicy Level', key: 'spicyLevel', width: 15 },
    { header: 'Prep Time (min)', key: 'prepTime', width: 15 },
    { header: 'Tags (comma-separated)', key: 'tags', width: 30 },
    { header: 'Available (Yes/No)', key: 'isAvailable', width: 18 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '00ADB5' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  worksheet.getRow(1).height = 30;

  // Instruction row
  const instructionRow = worksheet.addRow({
    name: 'e.g., Paneer Tikka',
    category: 'Starters / Main Course / Beverages (auto-created)',
    price: '250',
    subCategory: 'Veg Starters (optional, auto-created)',
    description: 'Item description (optional)',
    type: 'veg / non-veg / vegan / beverage (default: veg)',
    cuisine: 'indian / chinese / continental / italian / mexican / thai / other',
    spicyLevel: 'none / mild / medium / hot / extra-hot',
    prepTime: '15 (optional)',
    tags: 'popular, chef-special (optional)',
    isAvailable: 'Yes or No (default: Yes)',
  });
  instructionRow.font = { italic: true, color: { argb: '64748B' } };
  instructionRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F1F5F9' }
  };

  // Sample rows
  worksheet.addRow({
    name: 'Paneer Tikka',
    category: 'Starters',
    price: 250,
    subCategory: 'Veg Starters',
    description: 'Cottage cheese cubes marinated in spices and grilled',
    type: 'veg',
    cuisine: 'indian',
    spicyLevel: 'medium',
    prepTime: 15,
    tags: 'popular, chef-special',
    isAvailable: 'Yes',
  });

  worksheet.addRow({
    name: 'Chicken Tikka',
    category: 'Starters',
    price: 280,
    subCategory: 'Non-veg Starters',
    description: 'Tender chicken pieces marinated and grilled',
    type: 'non-veg',
    cuisine: 'indian',
    spicyLevel: 'hot',
    prepTime: 20,
    tags: 'popular, spicy',
    isAvailable: 'Yes',
  });

  worksheet.addRow({
    name: 'Dal Makhani',
    category: 'Main Course',
    price: 200,
    subCategory: 'Veg Main Course',
    description: 'Creamy black lentils cooked overnight',
    type: 'veg',
    cuisine: 'indian',
    spicyLevel: 'mild',
    prepTime: 25,
    tags: 'authentic, creamy',
    isAvailable: 'Yes',
  });

  worksheet.addRow({
    name: 'Butter Chicken',
    category: 'Main Course',
    price: 320,
    subCategory: 'Non-veg Main Course',
    description: 'Tender chicken in rich tomato gravy',
    type: 'non-veg',
    cuisine: 'indian',
    spicyLevel: 'medium',
    prepTime: 30,
    tags: 'popular, chef-special',
    isAvailable: 'Yes',
  });

  worksheet.addRow({
    name: 'Mango Lassi',
    category: 'Beverages',
    price: 80,
    subCategory: 'Cold Drinks',
    description: 'Fresh mango yogurt drink',
    type: 'beverage',
    cuisine: 'indian',
    spicyLevel: 'none',
    prepTime: 5,
    tags: 'refreshing, sweet',
    isAvailable: 'Yes',
  });

  worksheet.addRow({
    name: 'Masala Chai',
    category: 'Beverages',
    price: 40,
    subCategory: 'Hot Drinks',
    description: 'Indian spiced tea',
    type: 'beverage',
    cuisine: 'indian',
    spicyLevel: 'mild',
    prepTime: 5,
    tags: 'traditional, hot',
    isAvailable: 'Yes',
  });

  // Add borders
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'CBD5E1' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    });
  });

  // Instructions sheet
  const notesSheet = workbook.addWorksheet('Instructions');
  notesSheet.columns = [
    { header: 'Field', key: 'field', width: 20 },
    { header: 'Required?', key: 'required', width: 12 },
    { header: 'Valid Values / Notes', key: 'values', width: 65 },
  ];

  notesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  notesSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '00ADB5' }
  };

  const instructions = [
    { field: 'Item Name', required: 'YES', values: 'Name of the menu item (min 2 characters). Duplicate name in same category = skipped.' },
    { field: 'Category', required: 'YES', values: 'Category name — auto-created if it does not exist (e.g., Starters, Main Course, Beverages).' },
    { field: 'Price', required: 'YES', values: 'Item price in rupees (number, e.g., 250). Use 0 for complimentary items.' },
    { field: 'Sub-Category', required: 'No', values: 'Sub-category name — auto-created under the category if it does not exist.' },
    { field: 'Description', required: 'No', values: 'Short description of the item. Can be added later.' },
    { field: 'Type', required: 'No', values: 'veg, non-veg, vegan, beverage. Defaults to "veg" if empty or invalid.' },
    { field: 'Cuisine', required: 'No', values: 'indian, chinese, continental, italian, mexican, thai, other. Defaults to "other" if empty or invalid.' },
    { field: 'Spicy Level', required: 'No', values: 'none, mild, medium, hot, extra-hot. Defaults to "none" if empty or invalid.' },
    { field: 'Prep Time', required: 'No', values: 'Preparation time in minutes. Defaults to 15 if empty.' },
    { field: 'Tags', required: 'No', values: 'Comma-separated tags (e.g., popular, chef-special). Can be added later.' },
    { field: 'Available', required: 'No', values: 'Yes or No. Defaults to Yes if empty.' },
  ];

  instructions.forEach(inst => notesSheet.addRow(inst));

  notesSheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  });

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
 * Upload and Process Menu Items Excel File
 * POST /api/pos/bulk-upload
 *
 * CHANGES:
 * - Duplicate item in same category: SKIP silently with warning (don't block others)
 * - type/cuisine/spicyLevel invalid → auto-default instead of error
 * - price = 0 now allowed (free/complimentary items)
 * - Empty optional fields → defaults applied, no errors thrown
 * - Added skipped[] array in response
 * - Column order updated to match new template (price moved to col 3)
 */
export const bulkUploadMenuItems = asyncHandler(async (req, res) => {
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

  const worksheet = workbook.getWorksheet('Menu Items');
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
    categoriesCreated: 0,
    subCategoriesCreated: 0
  };

  const itemsToCreate = [];

  // Cache for categories and subcategories to avoid repeated DB calls
  const categoryCache = {};
  const subCategoryCache = {};

  // ✅ Fetch existing items to detect duplicates (name + category combo)
  const existingItems = await MenuItem.find({ hotel: hotelId }).select('name category');
  const existingItemsSet = new Set(
    existingItems.map(item => `${item.name.toLowerCase().trim()}-${item.category.toString()}`)
  );

  const validTypes = ['veg', 'non-veg', 'vegan', 'beverage'];
  const validCuisines = ['indian', 'chinese', 'continental', 'italian', 'mexican', 'thai', 'other'];
  const validSpicyLevels = ['none', 'mild', 'medium', 'hot', 'extra-hot'];

  // Helper: Get or create category
  const getOrCreateCategory = async (categoryName) => {
    const normalizedName = categoryName.trim();
    if (categoryCache[normalizedName]) return categoryCache[normalizedName];

    let category = await MenuCategory.findOne({ hotel: hotelId, name: normalizedName });
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
    if (subCategoryCache[cacheKey]) return subCategoryCache[cacheKey];

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

  // Process rows (skip header row 1 and instruction row 2)
  for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    // Skip fully empty rows
    const rowValues = row.values.filter(v => v !== null && v !== undefined && v !== '');
    if (rowValues.length === 0) continue;

    // Skip if name cell is empty
    if (!row.getCell(1).value) continue;

    results.total++;

    try {
      // ── Extract values (column order matches new template) ──
      // Col 1: Item Name, Col 2: Category, Col 3: Price
      // Col 4: Sub-Category, Col 5: Description, Col 6: Type
      // Col 7: Cuisine, Col 8: Spicy Level, Col 9: Prep Time
      // Col 10: Tags, Col 11: Available
      const name = row.getCell(1).value?.toString().trim();
      const categoryName = row.getCell(2).value?.toString().trim();
      const rawPrice = row.getCell(3).value;
      const subCategoryName = row.getCell(4).value?.toString().trim() || null;
      const description = row.getCell(5).value?.toString().trim() || '';
      const rawType = row.getCell(6).value?.toString().trim().toLowerCase() || '';
      const rawCuisine = row.getCell(7).value?.toString().trim().toLowerCase() || '';
      const rawSpicyLevel = row.getCell(8).value?.toString().trim().toLowerCase() || '';
      const prepTime = row.getCell(9).value ? parseInt(row.getCell(9).value) : 15;
      const tagsStr = row.getCell(10).value?.toString().trim() || '';
      const isAvailableStr = row.getCell(11).value?.toString().trim().toLowerCase() || 'yes';

      // ── Hard errors: only Name, Category, Price are truly required ──
      const errors = [];

      if (!name || name.length < 2) {
        errors.push('Item name is required (min 2 characters)');
      }
      if (!categoryName) {
        errors.push('Category is required');
      }
      const price = parseFloat(rawPrice);
      if (rawPrice === null || rawPrice === undefined || rawPrice === '' || isNaN(price) || price < 0) {
        errors.push('Valid price is required (use 0 for free items)');
      }

      if (errors.length > 0) {
        results.errors.push({ row: rowNumber, itemName: name || 'N/A', category: categoryName || 'N/A', errors });
        results.errorCount++;
        continue;
      }

      // ── Get or create category ──
      const category = await getOrCreateCategory(categoryName);

      // ✅ Duplicate check: same name + same category → SKIP, don't error
      const itemKey = `${name.toLowerCase().trim()}-${category._id.toString()}`;
      if (existingItemsSet.has(itemKey)) {
        results.skipped.push({
          row: rowNumber,
          itemName: name,
          category: categoryName,
          reason: `"${name}" already exists in "${categoryName}" — skipped`,
        });
        results.skippedCount++;
        continue;
      }
      existingItemsSet.add(itemKey); // prevent duplicates within same file

      // ✅ Auto-defaults for optional enum fields (no errors for invalid values)
      const type = validTypes.includes(rawType) ? rawType : 'veg';
      const cuisine = validCuisines.includes(rawCuisine) ? rawCuisine : 'other';
      const spicyLevel = validSpicyLevels.includes(rawSpicyLevel) ? rawSpicyLevel : 'none';

      // ── Get or create sub-category if provided ──
      let subCategoryId = null;
      if (subCategoryName) {
        const subCategory = await getOrCreateSubCategory(subCategoryName, category._id);
        subCategoryId = subCategory._id;
      }

      // Parse tags
      const tags = tagsStr
        ? tagsStr.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      // Parse availability
      const isAvailable = isAvailableStr === 'yes' || isAvailableStr === 'true' || isAvailableStr === '1';

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
        displayOrder: 0,
        createdBy: req.user._id
      };

      itemsToCreate.push(itemData);
      results.success.push({ row: rowNumber, itemName: name, category: categoryName, subCategory: subCategoryName || '-' });
      results.successCount++;

    } catch (error) {
      results.errors.push({ row: rowNumber, itemName: 'N/A', category: 'N/A', errors: [error.message] });
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
    `Bulk upload completed. ${results.successCount} items created, ${results.skippedCount} skipped (duplicates), ${results.categoriesCreated} categories created, ${results.subCategoriesCreated} sub-categories created, ${results.errorCount} errors.`,
    results
  );
});