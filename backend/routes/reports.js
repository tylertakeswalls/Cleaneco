const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const Order = require('../models/Order');
const Service = require('../models/Service');
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
    let completedRev = 0;
    let inProgressRev = 0;
    let pendingRev = 0;
    let cancelledRev = 0;

    orders.forEach(order => {
      const rev = calculateOrderCollectedRevenue(order);
      totalRevenue += rev;

      if (order.status === 'Completed') {
        completed++;
        completedRev += rev;
      } else if (order.status === 'In Progress') {
        inProgress++;
        inProgressRev += rev;
      } else if (order.status === 'Pending') {
        pending++;
        pendingRev += rev;
      } else if (order.status === 'Cancelled') {
        cancelled++;
        cancelledRev += rev;
      }
    });

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 45, bottom: 55, left: 72, right: 72 }
    });
    
    // Set response headers for inline PDF preview/print
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Cleaneco_Report_${period}_${now.getFullYear()}.pdf`);

    doc.pipe(res);

    const leftMargin = 72;
    const contentWidth = 468; // 612 - 72 - 72

    // -- HEADER --
    const headerPath = path.join(__dirname, '../../public/header.png');
    
    try {
      doc.image(headerPath, 55, 35, { width: 502 });
    } catch(err) { console.warn("header.png not found at " + headerPath); }

    doc.y = 115; // Ensure text starts below the header image
    
    const headerFont = 'Helvetica-Bold';
    
    doc.font(headerFont).fontSize(10.5).fillColor('#7F7F7F').text('CLEANECO WASTE MANAGEMENT SERVICES', leftMargin, doc.y, { align: 'left' });
    doc.moveDown(0.55);
    doc.font(headerFont).fontSize(9).fillColor('#0D8D1E');
    doc.text('Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite', leftMargin);
    doc.text('Tel. Nos.: (046) 477-0354 • 09173044157', leftMargin);
    doc.text('E-mail: cleaneco@cwms.com.ph', leftMargin);
    doc.text('Website: www.cwms.com.ph', leftMargin);
    
    doc.fillColor('#000000');
    doc.moveDown(1.4);
    
    // -- ADDRESS/DATE --
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.font('Times-Roman').fontSize(10.5).text(`Date: ${dateStr}`, leftMargin);
    doc.moveDown(0.8);
    doc.text('Cleaneco Management', leftMargin);
    doc.text('Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields', leftMargin);
    doc.text('Bacoor City, Cavite', leftMargin);
    doc.moveDown(0.9);
    const periodTitle = period.charAt(0).toUpperCase() + period.slice(1);
    doc.font('Times-Bold').fontSize(10.5).text(`SUBJECT: ${periodTitle} Operations & Financial Performance Summary`, leftMargin);
    
    doc.moveDown(1.2);
    doc.font('Times-Bold').fontSize(12).text(`${periodTitle.toUpperCase()} OPERATIONS AND SALES REPORT`, leftMargin, doc.y, {
      width: contentWidth,
      align: 'center'
    });
    
    doc.moveDown(0.9);
    const startDateLabel = startDate.toLocaleDateString('en-US', { timeZone: 'UTC' });
    const endDateLabel = endDate.toLocaleDateString('en-US', { timeZone: 'UTC' });
    doc.font('Times-Roman').fontSize(10.5).text(
      `This report summarizes the operational and financial performance for the ${period} period from ${startDateLabel} to ${endDateLabel}.`,
      leftMargin,
      doc.y,
      { width: contentWidth, align: 'justify' }
    );
    
    doc.moveDown(1.1);

    const formatMoney = (val) => `PHP ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatPct = (count) => orders.length > 0 ? `${((count / orders.length) * 100).toFixed(1)}%` : '0.0%';

    const borderWidth = 0.75; // Crisp 1px equivalent drawn on top of all fills

    // =========================================================================
    // TABLE 1: FINANCIAL & GROSS SALES SUMMARY
    // =========================================================================
    let tableY = Math.round(doc.y);
    const t1StartY = tableY;
    const rowHeight = 24;
    const col1Width = 310;
    const col2Width = contentWidth - col1Width; // 158

    // Table 1 Header Fill & Text
    doc.save()
      .rect(leftMargin, tableY, contentWidth, rowHeight)
      .fill('#F0F0F0')
      .restore();
    doc.font('Times-Bold').fontSize(10).fillColor('#000000');
    doc.text('FINANCIAL SUMMARY', leftMargin + 10, tableY + 7, { width: col1Width - 20, align: 'left' });
    doc.text('VALUE / AMOUNT', leftMargin + col1Width + 10, tableY + 7, { width: col2Width - 20, align: 'right' });
    tableY += rowHeight;

    const summaryRows = [
      { label: 'Reporting Coverage Period', value: `${startDateLabel} - ${endDateLabel}`, bold: false, bg: '#FFFFFF' },
      { label: 'Total Registered Bookings', value: `${orders.length} Orders`, bold: false, bg: '#FFFFFF' },
      { label: 'Gross Sales Collected (incl. 10% Service Tax)', value: formatMoney(totalRevenue), bold: true, bg: '#FFFFFF' }
    ];

    summaryRows.forEach((row) => {
      doc.save()
        .rect(leftMargin, tableY, contentWidth, rowHeight)
        .fill(row.bg)
        .restore();

      doc.font(row.bold ? 'Times-Bold' : 'Times-Roman').fontSize(10.5).fillColor('#000000');
      doc.text(row.label, leftMargin + 10, tableY + 7, { width: col1Width - 20, align: 'left' });
      doc.text(row.value, leftMargin + col1Width + 10, tableY + 7, { width: col2Width - 20, align: 'right' });
      tableY += rowHeight;
    });

    // Draw all Table 1 borders in a single pass on top of fills
    const t1TotalHeight = tableY - t1StartY;
    doc.save()
      .lineWidth(borderWidth)
      .strokeColor('#000000')
      .rect(leftMargin, t1StartY, contentWidth, t1TotalHeight);
    for (let i = 1; i <= summaryRows.length; i++) {
      const lineY = t1StartY + i * rowHeight;
      doc.moveTo(leftMargin, lineY).lineTo(leftMargin + contentWidth, lineY);
    }
    doc.moveTo(leftMargin + col1Width, t1StartY).lineTo(leftMargin + col1Width, tableY)
      .stroke()
      .restore();

    // =========================================================================
    // TABLE 2: ORDER STATUS BREAKDOWN (BLACK & WHITE WITH COLORED LEFT BAR ONLY)
    // =========================================================================
    tableY += 20;
    const t2StartY = tableY;
    const sCol1 = 165; // Status
    const sCol2 = 85;  // Bookings Count
    const sCol3 = 85;  // Share (%)
    const sCol4 = contentWidth - sCol1 - sCol2 - sCol3; // 133 - Collected Sales

    // Table 2 Header Fill & Text
    doc.save()
      .rect(leftMargin, tableY, contentWidth, rowHeight)
      .fill('#F0F0F0')
      .restore();
    doc.font('Times-Bold').fontSize(10).fillColor('#000000');
    doc.text('ORDER STATUS', leftMargin + 10, tableY + 7, { width: sCol1 - 20, align: 'left' });
    doc.text('BOOKINGS', leftMargin + sCol1, tableY + 7, { width: sCol2, align: 'center' });
    doc.text('SHARE (%)', leftMargin + sCol1 + sCol2, tableY + 7, { width: sCol3, align: 'center' });
    doc.text('COLLECTED (PHP)', leftMargin + sCol1 + sCol2 + sCol3, tableY + 7, { width: sCol4 - 10, align: 'right' });
    tableY += rowHeight;

    const statusRows = [
      { label: 'Completed Orders', count: completed, rev: completedRev, badgeColor: '#16A34A' },
      { label: 'In Progress Orders', count: inProgress, rev: inProgressRev, badgeColor: '#2563EB' },
      { label: 'Pending Orders', count: pending, rev: pendingRev, badgeColor: '#D97706' },
      { label: 'Cancelled Orders', count: cancelled, rev: cancelledRev, badgeColor: '#DC2626' }
    ];

    statusRows.forEach((row) => {
      doc.save()
        .rect(leftMargin, tableY, contentWidth, rowHeight)
        .fill('#FFFFFF')
        // Left color-coded accent bar (only colored element)
        .rect(leftMargin, tableY, 4.5, rowHeight)
        .fill(row.badgeColor)
        .restore();

      doc.font('Times-Roman').fontSize(10.5).fillColor('#000000');
      doc.text(row.label, leftMargin + 12, tableY + 7, { width: sCol1 - 20, align: 'left' });
      doc.text(String(row.count), leftMargin + sCol1, tableY + 7, { width: sCol2, align: 'center' });
      doc.text(formatPct(row.count), leftMargin + sCol1 + sCol2, tableY + 7, { width: sCol3, align: 'center' });
      doc.text(formatMoney(row.rev), leftMargin + sCol1 + sCol2 + sCol3, tableY + 7, { width: sCol4 - 10, align: 'right' });

      tableY += rowHeight;
    });

    // Table 2 Total Footer Row Fill & Text
    const footerHeight = rowHeight + 2;
    doc.save()
      .rect(leftMargin, tableY, contentWidth, footerHeight)
      .fill('#FFFFFF')
      .restore();

    doc.font('Times-Bold').fontSize(10.5).fillColor('#000000');
    doc.text('TOTAL', leftMargin + 12, tableY + 8, { width: sCol1 - 20, align: 'left' });
    doc.text(String(orders.length), leftMargin + sCol1, tableY + 8, { width: sCol2, align: 'center' });
    doc.text(orders.length > 0 ? '100.0%' : '0.0%', leftMargin + sCol1 + sCol2, tableY + 8, { width: sCol3, align: 'center' });
    doc.fillColor('#000000').text(formatMoney(totalRevenue), leftMargin + sCol1 + sCol2 + sCol3, tableY + 8, { width: sCol4 - 10, align: 'right' });
    tableY += footerHeight;

    // Draw all Table 2 borders in a single pass on top of all fills
    const t2TotalHeight = tableY - t2StartY;
    doc.save()
      .lineWidth(borderWidth)
      .strokeColor('#000000')
      .rect(leftMargin, t2StartY, contentWidth, t2TotalHeight);
    for (let i = 1; i <= statusRows.length + 1; i++) {
      const lineY = t2StartY + i * rowHeight;
      doc.moveTo(leftMargin, lineY).lineTo(leftMargin + contentWidth, lineY);
    }
    doc.moveTo(leftMargin + sCol1, t2StartY).lineTo(leftMargin + sCol1, tableY)
      .moveTo(leftMargin + sCol1 + sCol2, t2StartY).lineTo(leftMargin + sCol1 + sCol2, tableY)
      .moveTo(leftMargin + sCol1 + sCol2 + sCol3, t2StartY).lineTo(leftMargin + sCol1 + sCol2 + sCol3, tableY)
      .stroke()
      .restore();

    doc.end();
  } catch (error) {
    console.error('Error generating report:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate report' });
    }
  }
});

// GET /api/reports/inspection-list?serviceId=<optional>&status=<optional>
router.get('/inspection-list', async (req, res) => {
  try {
    const { serviceId, name, status } = req.query;
    const query = {};
    if (serviceId) {
      query._id = serviceId;
    }
    if (name) {
      query.name = name;
    }
    if (status === 'available' || status === 'unavailable') {
      query.status = status;
    }

    const services = await Service.find(query).sort({ created_at: 1, _id: 1 }).lean();
    const now = new Date();

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 45, bottom: 55, left: 72, right: 72 }
    });

    const safeFileSuffix = services.length === 1
      ? services[0].name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      : `All_Services_${now.getFullYear()}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Cleaneco_Inspection_Report_List_${safeFileSuffix}.pdf`);

    doc.pipe(res);

    const headerPath = path.join(__dirname, '../../public/header.png');
    const leftMargin = 72;
    const contentWidth = 468; // 612 - 72 - 72
    const pageBottomLimit = 720;

    const ensureSpace = (neededHeight = 60) => {
      if (doc.y + neededHeight > pageBottomLimit) {
        doc.addPage();
      }
    };

    // -- HEADER IMAGE (Matches sample PDF reference) --
    try {
      doc.image(headerPath, 55, 35, { width: 502 });
    } catch (err) {
      console.warn('header.png not found at ' + headerPath);
    }

    doc.y = 115;

    // -- SUB-HEADER COMPANY BLOCK --
    const headerFont = 'Helvetica-Bold';
    doc.font(headerFont).fontSize(10.5).fillColor('#7F7F7F').text('CLEANECO WASTE MANAGEMENT SERVICES', leftMargin, doc.y, { align: 'left' });
    doc.moveDown(0.55);
    doc.font(headerFont).fontSize(9).fillColor('#0D8D1E');
    doc.text('Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite', leftMargin);
    doc.text('Tel. Nos.: (046) 477-0354 • 09173044157', leftMargin);
    doc.text('E-mail: cleaneco@cwms.com.ph', leftMargin);
    doc.text('Website: www.cwms.com.ph', leftMargin);

    doc.fillColor('#000000');
    doc.moveDown(1.6);

    // -- DATE & SUBJECT --
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
    doc.font('Times-Roman').fontSize(10.5).text(`Date: ${dateStr}`, leftMargin);
    doc.moveDown(0.8);
    doc.font('Times-Bold').fontSize(10.5).text('SUBJECT: On-Site Service Inspection & Assessment', leftMargin);

    doc.moveDown(1.4);

    const rightEdge = leftMargin + contentWidth; // 540

    // Draws a label followed by crisp horizontal line(s) extending uniformly to rightEdge
    const drawFillLine = (label, x = leftMargin, fontName = 'Times-Roman', fontSize = 10.5, linesCount = 1) => {
      doc.font(fontName).fontSize(fontSize).fillColor('#000000');
      const currentY = doc.y;
      doc.text(label, x, currentY, { lineBreak: false });
      const labelWidth = doc.widthOfString(label);
      const lineStartX = x + labelWidth + 5;
      let baselineY = currentY + fontSize - 0.5;
      if (lineStartX < rightEdge) {
        doc.save()
          .strokeColor('#000000')
          .lineWidth(0.6)
          .moveTo(lineStartX, baselineY)
          .lineTo(rightEdge, baselineY)
          .stroke()
          .restore();
      }
      for (let i = 1; i < linesCount; i++) {
        baselineY += 16;
        doc.save()
          .strokeColor('#000000')
          .lineWidth(0.6)
          .moveTo(x, baselineY)
          .lineTo(rightEdge, baselineY)
          .stroke()
          .restore();
      }
      doc.x = leftMargin;
      doc.y = baselineY + 6;
    };

    // Draws a clean horizontal divider line between factors/sections
    const drawFactorDivider = (xStart = leftMargin) => {
      const dividerY = doc.y + 5;
      doc.save()
        .strokeColor('#CCCCCC')
        .lineWidth(0.6)
        .moveTo(xStart, dividerY)
        .lineTo(rightEdge, dividerY)
        .stroke()
        .restore();
      doc.y = dividerY + 11;
    };

    // -- CENTERED DOCUMENT TITLE --
    const docTitle = services.length === 1
      ? `${String(services[0].name || 'SERVICE').toUpperCase()} INSPECTION REPORT LIST`
      : 'SERVICE INSPECTION REPORT LIST';
    doc.font('Times-Bold').fontSize(11.5).text(docTitle, leftMargin, doc.y, {
      width: contentWidth,
      align: 'center'
    });

    doc.moveDown(1.2);

    if (services.length === 0) {
      doc.font('Times-Roman').fontSize(10.5).text('No services matched the selected criteria.', leftMargin, doc.y, {
        width: contentWidth,
        align: 'left'
      });
    } else if (services.length === 1) {
      // Single-service layout: service description followed by numbered factors (1., 2., 3.)
      const service = services[0];
      if (service.description) {
        doc.font('Times-Roman').fontSize(10.5).fillColor('#000000').text(service.description.trim(), leftMargin, doc.y, {
          width: contentWidth,
          align: 'justify',
          lineGap: 1.5
        });
        doc.moveDown(0.5);
        drawFactorDivider(leftMargin);
      }

      const fields = Array.isArray(service.fields) ? service.fields : [];
      if (fields.length === 0) {
        doc.font('Times-Bold').fontSize(10.5).fillColor('#000000').text(
          '1.   Standard Service Verification',
          leftMargin + 18,
          doc.y,
          { width: contentWidth - 18, align: 'left' }
        );
        doc.moveDown(0.35);
        drawFillLine('Inspector Remarks:', leftMargin, 'Times-Roman', 10.5, 2);
        drawFactorDivider(leftMargin);
      } else {
        fields.forEach((field, fIdx) => {
          const options = Array.isArray(field.options) ? field.options : [];
          ensureSpace(80 + options.length * 18);

          // Numbered factor heading matching sample PDF ("1.   Factor Name")
          doc.font('Times-Bold').fontSize(10.5).fillColor('#000000').text(
            `${fIdx + 1}.   ${field.label}`,
            leftMargin + 18,
            doc.y,
            { width: contentWidth - 18, align: 'left' }
          );
          doc.moveDown(0.35);

          if (field.type === 'number') {
            drawFillLine('Recorded Quantity / Count:', leftMargin);
            doc.moveDown(0.2);
            drawFillLine('Inspector Remarks:', leftMargin, 'Times-Roman', 10.5, 2);
          } else if (options.length > 0) {
            options.forEach((opt) => {
              ensureSpace(20);
              doc.font('Times-Roman').fontSize(10.5).fillColor('#000000').text(
                `[   ]  ${opt.label}`,
                leftMargin,
                doc.y,
                { width: contentWidth }
              );
              doc.moveDown(0.15);
            });
            doc.moveDown(0.2);
            drawFillLine('Inspector Remarks:', leftMargin, 'Times-Roman', 10.5, 2);
          }

          drawFactorDivider(leftMargin);
        });
      }
    } else {
      // All-services layout: numbered services (1., 2., 3.) with clean factor checklists underneath
      services.forEach((service, sIdx) => {
        ensureSpace(105);

        // Indented numbered service title (matching "1.   Services Provided" in sample PDF)
        doc.font('Times-Bold').fontSize(10.5).fillColor('#000000').text(
          `${sIdx + 1}.   ${service.name}`,
          leftMargin + 18,
          doc.y,
          { width: contentWidth - 18, align: 'left' }
        );
        doc.moveDown(0.25);

        if (service.description) {
          doc.font('Times-Roman').fontSize(10.5).fillColor('#000000').text(service.description.trim(), leftMargin, doc.y, {
            width: contentWidth,
            align: 'justify',
            lineGap: 1.5
          });
          doc.moveDown(0.45);
        }

        const fields = Array.isArray(service.fields) ? service.fields : [];
        if (fields.length === 0) {
          ensureSpace(55);
          drawFillLine('Inspector Remarks:', leftMargin + 18, 'Times-Roman', 10.5, 2);
          drawFactorDivider(leftMargin);
        } else {
          fields.forEach((field) => {
            const options = Array.isArray(field.options) ? field.options : [];
            ensureSpace(75 + options.length * 18);

            // Clean Factor Heading without formula/pricing jargon
            doc.font('Times-Bold').fontSize(10.5).fillColor('#000000').text(
              `•  ${field.label}`,
              leftMargin + 18,
              doc.y,
              { width: contentWidth - 18, align: 'left' }
            );
            doc.moveDown(0.25);

            if (field.type === 'number') {
              drawFillLine('Recorded Quantity / Count:', leftMargin + 30);
              doc.moveDown(0.15);
              drawFillLine('Inspector Remarks:', leftMargin + 30, 'Times-Roman', 10.5, 2);
            } else if (options.length > 0) {
              options.forEach((opt) => {
                ensureSpace(20);
                doc.font('Times-Roman').fontSize(10.5).fillColor('#000000').text(
                  `[   ]  ${opt.label}`,
                  leftMargin + 30,
                  doc.y,
                  { width: contentWidth - 30 }
                );
                doc.moveDown(0.15);
              });
              doc.moveDown(0.15);
              drawFillLine('Inspector Remarks:', leftMargin + 30, 'Times-Roman', 10.5, 2);
            }

            drawFactorDivider(leftMargin + 18);
          });
        }

        doc.moveDown(0.35);
      });
    }

    if (services.length > 0) {
      ensureSpace(65);
      doc.moveDown(0.4);
      doc.font('Times-Bold').fontSize(10.5).fillColor('#000000').text(
        'Inspected By (Name & Signature):',
        leftMargin,
        doc.y,
        { width: contentWidth, align: 'left' }
      );
      doc.moveDown(0.6);
      doc.font('Times-Bold').fontSize(10.5).fillColor('#000000').text(
        'Date:',
        leftMargin,
        doc.y,
        { width: contentWidth, align: 'left' }
      );
    }

    doc.end();
  } catch (error) {
    console.error('Error generating inspection report list:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to generate inspection report list' });
    }
  }
});

module.exports = router;
