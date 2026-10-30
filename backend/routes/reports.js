const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const Order = require('../models/Order');
const { groupOrdersByOrderId, calculateOrderCollectedRevenue } = require('../utils/pricing');

// GET /api/reports/generate?period=monthly|quarterly|yearly
router.get('/generate', async (req, res) => {
  try {
    const period = req.query.period || 'monthly';
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let startDate, endDate;

    if (period === 'monthly') {
      startDate = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
    } else if (period === 'quarterly') {
      const quarter = Math.floor(currentMonth / 3);
      startDate = new Date(Date.UTC(currentYear, quarter * 3, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(currentYear, quarter * 3 + 3, 0, 23, 59, 59, 999));
    } else if (period === 'yearly') {
      startDate = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
    } else {
      return res.status(400).json({ message: 'Invalid period selected.' });
    }

    const rawOrders = await Order.find({ date: { $gte: startDate, $lte: endDate } }).sort({ created_at: -1, _id: -1 }).lean();
    const orders = groupOrdersByOrderId(rawOrders);

    let totalRevenue = 0;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    let cancelled = 0;

    orders.forEach(order => {
      totalRevenue += calculateOrderCollectedRevenue(order);

      if (order.status === 'Completed') {
        completed++;
      } else if (order.status === 'In Progress') {
        inProgress++;
      } else if (order.status === 'Pending') {
        pending++;
      } else if (order.status === 'Cancelled') {
        cancelled++;
      }
    });

    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers to prompt a file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Cleaneco_Report_${period}_${now.getFullYear()}.pdf`);

    doc.pipe(res);

    // -- HEADER --
    const headerPath = path.join(__dirname, '../../public/header.png');
    
    try {
      doc.image(headerPath, 50, 40, { width: 500 });
    } catch(err) { console.warn("header.png not found at " + headerPath); }

    doc.y = 110; // Ensure text starts below the header image
    
    const headerFont = 'Helvetica-Bold';
    
    doc.font(headerFont).fontSize(9).fillColor('gray').text('CLEANECO WASTE MANAGEMENT SERVICES', { align: 'left' });
    doc.moveDown(0.3);
    doc.font(headerFont).fontSize(9).fillColor('green');
    doc.text('Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite');
    doc.text('Tel. Nos.: (046) 477-0354 • 09173044157');
    doc.text('E-mail: cleaneco@cwms.com.ph');
    doc.text('Website: www.cwms.com.ph');
    
    doc.fillColor('black');
    doc.moveDown(2);
    
    // -- ADDRESS/DATE --
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.font('Times-Roman').fontSize(11).text(`Date: ${dateStr}`);
    doc.moveDown(1.5);
    doc.text('Cleaneco Management');
    doc.text('Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields');
    doc.text('Bacoor City, Cavite');
    doc.moveDown(1.5);
    doc.font('Times-Bold').text('ATTENTION:');
    
    doc.moveDown(1.5);
    const periodTitle = period.charAt(0).toUpperCase() + period.slice(1);
    doc.font('Times-Bold').fontSize(12).text(`${periodTitle} Operations and Sales Report`, { align: 'center', underline: true });
    
    doc.moveDown(1.5);
    const startDateLabel = startDate.toLocaleDateString('en-US', { timeZone: 'UTC' });
    const endDateLabel = endDate.toLocaleDateString('en-US', { timeZone: 'UTC' });
    doc.font('Times-Roman').fontSize(11).text(`This report summarizes the operational and sales performance for the ${period} period starting from ${startDateLabel} to ${endDateLabel}.`, { align: 'justify' });
    
    doc.moveDown(2);
    
    // -- DATA SUMMARY --
    doc.font('Times-Bold').text('Gross Sales Summary:');
    doc.font('Times-Roman').text(`Gross Sales (incl. 10% Tax): PHP ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    doc.moveDown(1);
    doc.font('Times-Bold').text('Order Statistics:');
    doc.font('Times-Roman')
       .text(`Total Orders: ${orders.length}`)
       .text(`Completed Orders: ${completed}`)
       .text(`In Progress Orders: ${inProgress}`)
       .text(`Pending Orders: ${pending}`)
       .text(`Cancelled Orders: ${cancelled}`);
    
    doc.moveDown(4);
    
    // -- SIGNOFF --
    doc.text('Thank you very much!');

    doc.end();
  } catch (error) {
    console.error('Error generating report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate report' });
    }
  }
});

module.exports = router;
