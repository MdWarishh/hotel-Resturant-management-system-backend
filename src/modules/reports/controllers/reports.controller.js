import Invoice from '../../billing/models/Invoice.model.js';
import Booking from '../../rooms/models/Booking.model.js';
import Hotel from '../../hotels/models/Hotel.model.js';
import Order from '../../pos/models/Order.model.js';
import Room from '../../rooms/models/Room.model.js';
import StockTransaction from '../../inventory/models/StockTransaction.model.js';
import { successResponse } from '../../../utils/responseHandler.js';
import { HTTP_STATUS, USER_ROLES } from '../../../config/constants.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import AppError from '../../../utils/AppError.js';
import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake/build/pdfmake.js';
import * as pdfFonts from 'pdfmake/build/vfs_fonts.js';
pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs; 
/**
 * Get Revenue Report
 * GET /api/reports/revenue
 * Access: Hotel Admin, Manager
 */
export const getRevenueReport = asyncHandler(async (req, res) => {
  const { hotel, startDate, endDate, groupBy = 'day' } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  if (!assignedHotel) {
    throw new AppError('Hotel ID is required', HTTP_STATUS.BAD_REQUEST);
  }

  // Date range
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();


  


  // Group by format
  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      break;
    case 'year':
      dateFormat = { $dateToString: { format: '%Y', date: '$createdAt' } };
      break;
    default: // day
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  // Aggregate revenue
 const revenueData = await Order.aggregate([
    {
      $match: {
        hotel: assignedHotel,
        createdAt: { $gte: start, $lte: end },
        status: 'served', // Match the status we set in orderPayment.controller
      },
    },
    {
      $group: {
        _id: dateFormat,
        totalRevenue: { $sum: '$pricing.total' },
        roomRevenue:{ $sum: '$charges.roomCharges' }, // POS orders don't usually have room charges
        foodRevenue: { $sum: '$pricing.total' },
        taxCollected: { $sum: '$pricing.tax' }, // Ensure this field name matches your Order model
        invoiceCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);


  // Calculate totals
  const totals = {
    totalRevenue: revenueData.reduce((sum, item) => sum + item.totalRevenue, 0),
    roomRevenue: revenueData.reduce((sum, item) => sum + item.roomRevenue, 0),
    foodRevenue: revenueData.reduce((sum, item) => sum + item.foodRevenue, 0),
    taxCollected: revenueData.reduce((sum, item) => sum + item.taxCollected, 0),
    invoiceCount: revenueData.reduce((sum, item) => sum + item.invoiceCount, 0),
  };

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Revenue report fetched successfully',
    {
      report: revenueData,
      totals,
      period: { startDate: start, endDate: end, groupBy },
    }
  );
});

/**
 * Get Occupancy Report
 * GET /api/reports/occupancy
 * Access: Hotel Admin, Manager
 */
export const getOccupancyReport = asyncHandler(async (req, res) => {
  const { hotel, startDate, endDate } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  if (!assignedHotel) {
    throw new AppError('Hotel ID is required', HTTP_STATUS.BAD_REQUEST);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Get total rooms
  const totalRooms = await Room.countDocuments({
    hotel: assignedHotel,
    isActive: true,
  });

  // Aggregate bookings by date
const occupancyData = await Booking.aggregate([
    {
      $match: {
        hotel: assignedHotel,
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
        // Ensure the booking overlaps with our report range
        'dates.checkIn': { $lte: end },
        'dates.checkOut': { $gte: start }
      },
    },
    // We project the dates to help grouping
    {
      $project: {
        checkIn: '$dates.checkIn',
        checkOut: '$dates.checkOut',
        adults: '$numberOfGuests.adults'
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkIn' } },
        occupiedRooms: { $sum: 1 },
        totalGuests: { $sum: '$adults' },
    dailyRevenue: { $sum: { $ifNull: ['$pricing.total', 0] } }
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Calculate metrics for the frontend
  const report = occupancyData.map((item) => {
    const occRate = totalRooms > 0 ? (item.occupiedRooms / totalRooms) * 100 : 0;
const dailyAdr = item.occupiedRooms > 0 ? item.dailyRevenue / item.occupiedRooms : 0;
    
    // RevPAR = Revenue / Total Rooms Available
    const dailyRevpar = totalRooms > 0 ? item.dailyRevenue / totalRooms : 0;

    return {
      date: item._id,
      occupiedRooms: item.occupiedRooms,
      availableRoomNights: totalRooms,
      totalRoomNights: item.occupiedRooms, // Rooms sold
      occupancyRate: Math.round(occRate),
      totalGuests: item.totalGuests,
      // Default ADR/RevPAR to 0 if not calculated here
     adr: Math.round(dailyAdr),
      revpar: Math.round(dailyRevpar)
    };
  });

  // Calculate summary for cards
  const summary = {
    totalRooms,
    averageOccupancy: report.length > 0 
      ? Math.round(report.reduce((sum, i) => sum + i.occupancyRate, 0) / report.length) 
      : 0,
    totalRoomNights: report.reduce((sum, i) => sum + i.occupiedRooms, 0),
    adr: report.length > 0 ? Math.round(report.reduce((sum, item) => sum + item.adr, 0) / report.length) : 0,
    revpar: report.length > 0 ? Math.round(report.reduce((sum, item) => sum + item.revpar, 0) / report.length) : 0
  };

  

  // Calculate average occupancy
  const avgOccupancy =
    report.length > 0
      ? Math.round(report.reduce((sum, item) => sum + item.occupancyRate, 0) / report.length)
      : 0;

      // Inside your reports.controller.js

      const totalRoomNightsSold = report.reduce((sum, item) => sum + item.occupiedRooms, 0);
  const totalPeriodRevenue = report.reduce((sum, item) => sum + (item.occupiedRooms * item.adr), 0);
const totals = {
    totalRooms,
    averageOccupancy: report.length > 0 
      ? Math.round(report.reduce((sum, i) => sum + i.occupancyRate, 0) / report.length) 
      : 0,
    totalRoomNights: totalRoomNightsSold,
    adr: totalRoomNightsSold > 0 ? Math.round(totalPeriodRevenue / totalRoomNightsSold) : 0,
    revpar: totalRooms > 0 ? Math.round(totalPeriodRevenue / (totalRooms * report.length || 1)) : 0
  };

return successResponse(
    res,
    HTTP_STATUS.OK,
    'Occupancy report fetched successfully',
    {
      report, // This is your array of daily data
      summary: {
        ...totals, // This spreads adr, revpar, and totalRoomNights into the summary
        period: { startDate: start, endDate: end },
      },
    }
  );
});

/**
 * Get Sales Report (POS)
 * GET /api/reports/sales
 * Access: Hotel Admin, Manager
 */
export const getSalesReport = asyncHandler(async (req, res) => {
  const { hotel, startDate, endDate, groupBy = 'day' } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  if (!assignedHotel) {
    throw new AppError('Hotel ID is required', HTTP_STATUS.BAD_REQUEST);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  // Group by format
  let dateFormat;
  switch (groupBy) {
    case 'month':
      dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
      break;
    default:
      dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  }

  const salesData = await Order.aggregate([
    {
      $match: {
        hotel: assignedHotel,
        createdAt: { $gte: start, $lte: end },
        status: 'served',
      },
    },
    {
      $group: {
        _id: dateFormat,
        totalSales: { $sum: '$pricing.total' },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: '$pricing.total' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Top selling items
  const topItems = await Order.aggregate([
    {
      $match: {
        hotel: assignedHotel,
        createdAt: { $gte: start, $lte: end },
        status: 'served',
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.name',
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.subtotal' },
      },
    },
    {
      $sort: { quantity: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  const totals = {
    totalSales: salesData.reduce((sum, item) => sum + item.totalSales, 0),
    orderCount: salesData.reduce((sum, item) => sum + item.orderCount, 0),
    avgOrderValue: salesData.length > 0
      ? Math.round(salesData.reduce((sum, item) => sum + item.avgOrderValue, 0) / salesData.length)
      : 0,
  };

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Sales report fetched successfully',
    {
      report: salesData,
      topItems,
      totals,
      period: { startDate: start, endDate: end, groupBy },
    }
  );
});

/**
 * Get Inventory Report
 * GET /api/reports/inventory
 * Access: Hotel Admin, Manager
 */
export const getInventoryReport = asyncHandler(async (req, res) => {
  const { hotel, startDate, endDate, transactionType } = req.query;

  let assignedHotel = hotel;
  if (req.user.role !== USER_ROLES.SUPER_ADMIN) {
    assignedHotel = req.user.hotel._id;
  }

  if (!assignedHotel) {
    throw new AppError('Hotel ID is required', HTTP_STATUS.BAD_REQUEST);
  }

  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  const matchQuery = {
    hotel: assignedHotel,
    createdAt: { $gte: start, $lte: end },
  };

  if (transactionType) {
    matchQuery.transactionType = transactionType;
  }

  const inventoryData = await StockTransaction.aggregate([
    {
      $match: matchQuery,
    },
    {
      $lookup: {
        from: 'inventoryitems',
        localField: 'inventoryItem',
        foreignField: '_id',
        as: 'item',
      },
    },
    {
      $unwind: '$item',
    },
    {
      $group: {
        _id: {
          item: '$item.name',
          type: '$transactionType',
        },
        totalQuantity: { $sum: '$quantity' },
        totalCost: { $sum: '$cost.totalPrice' },
        transactionCount: { $sum: 1 },
      },
    },
    {
      $sort: { totalQuantity: -1 },
    },
  ]);

  const summary = {
    totalTransactions: inventoryData.reduce((sum, item) => sum + item.transactionCount, 0),
    totalCost: inventoryData.reduce((sum, item) => sum + item.totalCost, 0),
  };

  return successResponse(
    res,
    HTTP_STATUS.OK,
    'Inventory report fetched successfully',
    {
      report: inventoryData,
      summary,
      period: { startDate: start, endDate: end },
    }
  );
});






export const generateGSTReport = async (req, res) => {
  try {
    const { hotelId, dateFrom, dateTo, format = 'pdf' } = req.query;

    // Security
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    // const isOwner = hotel.owner && hotel.owner.equals(req.user._id);
    // if (!isOwner) {
    //   return res.status(403).json({ message: 'Unauthorized access to this hotel report' });
    // }

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);

    // Fetch bookings — invoice date = checkout date (standard for hotels)
    const bookings = await Booking.find({
      hotel: hotelId,
      'dates.checkOut': { $gte: start, $lte: end },
      status: 'checked_out'                     // Only completed bookings
    })
      .populate('guest')
      .populate('room')
      .sort({ 'dates.checkOut': 1 });

    // Process data + dynamic GST fallback
    const reportRows = bookings.map((booking, index) => {
      const checkIn = new Date(booking.dates.checkIn);
      const checkOut = new Date(booking.dates.checkOut);
     const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)) || 1;

      const base = booking.pricing?.baseAmount || 0;
      const discount = booking.pricing?.discountAmount || 0;
      const taxable = booking.pricing?.taxableAmount || (base - discount);

      // Use stored GST if available, else compute dynamically
      let cgstAmount = booking.pricing?.cgstAmount || 0;
      let sgstAmount = booking.pricing?.sgstAmount || 0;
      let igstAmount = booking.pricing?.igstAmount || 0;

      if (!cgstAmount && !sgstAmount && !igstAmount) {
        const rate = booking.pricing?.gstRate || 18;
        const guestState = booking.guest?.state || hotel.address?.state;
        const isIntraState = guestState === hotel.address?.state;

        if (isIntraState) {
          cgstAmount = sgstAmount = (taxable * (rate / 2)) / 100;
        } else {
          igstAmount = (taxable * rate) / 100;
        }
      }

      const totalGst = cgstAmount + sgstAmount + igstAmount;
      const finalAmount = taxable + totalGst;

      return {
        bookingNumber: booking.bookingNumber,
        invoiceNumber: booking.invoiceNumber || `INV-${booking.bookingNumber}`,
        invoiceDate: checkOut.toISOString().split('T')[0],
        guestName: booking.guest?.name || '',
        room: `${booking.room?.roomNumber || ''} - ${booking.room?.roomType || ''}`,
        checkIn: checkIn.toISOString().split('T')[0],
        checkOut: checkOut.toISOString().split('T')[0],
        nights: nights,
        baseAmount: base,
        discount,
        taxableAmount: taxable,
        cgstPercent: cgstAmount ? (booking.pricing?.gstRate || 18) / 2 : 0,
        cgstAmount,
        sgstPercent: sgstAmount ? (booking.pricing?.gstRate || 18) / 2 : 0,
        sgstAmount,
        igstPercent: igstAmount ? (booking.pricing?.gstRate || 18) : 0,
        igstAmount,
        totalGst,
        finalAmount
      };
    });

    // Consolidated Summary
    const summary = {
      totalBookings: reportRows.length,
      totalTaxable: reportRows.reduce((sum, r) => sum + r.taxableAmount, 0),
      totalCGST: reportRows.reduce((sum, r) => sum + r.cgstAmount, 0),
      totalSGST: reportRows.reduce((sum, r) => sum + r.sgstAmount, 0),
      totalIGST: reportRows.reduce((sum, r) => sum + r.igstAmount, 0),
      totalGST: reportRows.reduce((sum, r) => sum + r.totalGst, 0),
      grandTotal: reportRows.reduce((sum, r) => sum + r.finalAmount, 0)
    };

    const period = `${dateFrom} to ${dateTo}`;
    const generatedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('GST Revenue Report');

      // Header
      ws.mergeCells('A1:S1');
      ws.getCell('A1').value = hotel.name.toUpperCase();
      ws.getCell('A1').font = { bold: true, size: 16 };
      ws.getCell('A1').alignment = { horizontal: 'center' };

     ws.addRow([
  `GSTIN: ${hotel.gstin || 'N/A'} | State: ${hotel.address?.state || 'N/A'} (${hotel.address?.stateCode || ''})`
]);
      ws.addRow([`Report Period: ${period} | Generated: ${generatedOn}`]);
      ws.addRow([]);

      // Table Header
      ws.addRow([
        'Booking #', 'Invoice #', 'Invoice Date', 'Guest Name', 'Room', 
        'Check-in', 'Check-out', 'Nights', 'Room Charges', 'Discount',
        'Taxable Amt', 'CGST %', 'CGST', 'SGST %', 'SGST', 'IGST %', 'IGST', 'Total GST', 'Final Amt'
      ]);

      // Data
      reportRows.forEach(r => {
        ws.addRow([
          r.bookingNumber, r.invoiceNumber, r.invoiceDate, r.guestName, r.room,
          r.checkIn, r.checkOut, r.nights, r.baseAmount, r.discount, r.taxableAmount,
          r.cgstPercent, r.cgstAmount, r.sgstPercent, r.sgstAmount,
          r.igstPercent, r.igstAmount, r.totalGst, r.finalAmount
        ]);
      });

      // Summary
      ws.addRow([]);
      ws.addRow(['CONSOLIDATED SUMMARY']);
      ws.addRow(['Total Bookings', summary.totalBookings]);
      ws.addRow(['Total Taxable Value', summary.totalTaxable.toFixed(2)]);
      ws.addRow(['Total CGST', summary.totalCGST.toFixed(2)]);
      ws.addRow(['Total SGST', summary.totalSGST.toFixed(2)]);
      ws.addRow(['Total IGST', summary.totalIGST.toFixed(2)]);
      ws.addRow(['Total GST', summary.totalGST.toFixed(2)]);
      ws.addRow(['Grand Total Revenue', summary.grandTotal.toFixed(2)]);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=GST_Report_${dateFrom}_to_${dateTo}.xlsx`);

      return workbook.xlsx.write(res).then(() => res.end());
    } 

    // PDF using pdfmake (best for clean tabular reports)
    else {
      const docDefinition = {
        content: [
          { text: hotel.name.toUpperCase(), style: 'header' },
          { text: `${hotel.address.fullAddress || ''} | GSTIN: ${hotel.gstin}`, style: 'subheader' },
          { text: `State: ${hotel.address.state} (${hotel.address.stateCode})`, style: 'subheader' },
          { text: `Report Period: ${period} | Generated: ${generatedOn}`, style: 'subheader' },
          { text: 'GST Revenue Report', style: 'title' },

          {
            table: {
              headerRows: 1,
              widths: ['auto','auto','auto','*','auto','auto','auto','auto','auto','auto','auto','auto','auto','auto','auto','auto','auto','auto','auto'],
              body: [
                ['Bk #','Inv #','Date','Guest','Room','In','Out','Nts','Base','Disc','Taxable','CGST%','CGST','SGST%','SGST','IGST%','IGST','Tot GST','Final'],
                ...reportRows.map(r => [
                  r.bookingNumber, r.invoiceNumber, r.invoiceDate, r.guestName, r.room,
                  r.checkIn, r.checkOut, r.nights, r.baseAmount.toFixed(2), r.discount.toFixed(2),
                  r.taxableAmount.toFixed(2), r.cgstPercent, r.cgstAmount.toFixed(2),
                  r.sgstPercent, r.sgstAmount.toFixed(2), r.igstPercent, r.igstAmount.toFixed(2),
                  r.totalGst.toFixed(2), r.finalAmount.toFixed(2)
                ])
              ]
            },
            layout: 'lightHorizontalLines'
          },

          { text: 'Consolidated Summary', style: 'section', margin: [0, 20, 0, 10] },
          {
            table: {
              body: [
                ['Total Bookings', summary.totalBookings],
                ['Total Taxable Value', `₹${summary.totalTaxable.toFixed(2)}`],
                ['Total CGST', `₹${summary.totalCGST.toFixed(2)}`],
                ['Total SGST', `₹${summary.totalSGST.toFixed(2)}`],
                ['Total IGST', `₹${summary.totalIGST.toFixed(2)}`],
                ['Total GST', `₹${summary.totalGST.toFixed(2)}`],
                ['Grand Total Revenue', `₹${summary.grandTotal.toFixed(2)}`]
              ]
            }
          }
        ],
        styles: {
          header: { fontSize: 18, bold: true },
          title: { fontSize: 16, bold: true, margin: [0, 15, 0, 10] },
          section: { fontSize: 14, bold: true }
        },
        defaultStyle: { fontSize: 9 }
      };

      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer) => {
  try {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length); // Help the browser know the size
    res.setHeader('Content-Disposition', `attachment; filename=GST_Report.pdf`);
    res.status(200).send(buffer); // res.send is better for buffers than res.end
  } catch (err) {
    console.error('PDF Stream Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error streaming PDF' });
    }
  }
});
    }
  } catch (error) {
    console.error('GST Report Error:', error);
    res.status(500).json({ message: 'Failed to generate GST report' });
  }
};