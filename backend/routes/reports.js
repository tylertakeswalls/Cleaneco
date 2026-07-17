const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const Order = require('../models/Order');

// GET /api/reports/generate?period=monthly|quarterly|yearly
router.get('/generate', async (req, res) => {
  try {
    const period = req.query.period || 'monthly';
    const now = new Date();
    let startDate, endDate;

    if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'quarterly') {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59, 999);
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      return res.status(400).json({ message: 'Invalid period selected.' });
    }

    const orders = await Order.find({ date: { $gte: startDate, $lte: endDate } });

    let totalRevenue = 0;
    let completed = 0;
    let pending = 0;
    let cancelled = 0;

    orders.forEach(order => {
      const price = parseFloat(String(order.price || '').replace(/[₱,]/g, '').trim()) || 0;
      if (order.status === 'Completed') {
        totalRevenue += price;
        completed++;
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
    
    // Use Arial Rounded MT Bold for the header text
    try {
      doc.registerFont('ArialRoundedMT', 'C:/Windows/Fonts/ARLRDBD.TTF');
    } catch(err) { console.warn("Arial Rounded MT font not found, falling back."); }
    
    const headerFont = 'ArialRoundedMT'; // fallback is handled implicitly if not found
    
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
    doc.font('Times-Roman').fontSize(11).text(`This report summarizes the operational and sales performance for the ${period} period starting from ${startDate.toLocaleDateString('en-US')} to ${endDate.toLocaleDateString('en-US')}.`, { align: 'justify' });
    
    doc.moveDown(2);
    
    // -- DATA SUMMARY --
    doc.font('Times-Bold').text('Revenue Summary:');
    doc.font('Times-Roman').text(`Total Completed Revenue: PHP ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
    
    doc.moveDown(1);
    doc.font('Times-Bold').text('Order Statistics:');
    doc.font('Times-Roman')
       .text(`Total Orders: ${orders.length}`)
       .text(`Completed Orders: ${completed}`)
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
