const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 50 });
const outputPath = path.join(__dirname, 'tos_sample.pdf');
doc.pipe(fs.createWriteStream(outputPath));

// Header
doc.fontSize(20).fillColor('#0D8D1E').text('CLEANECO', { align: 'left', continued: true })
   .fillColor('#000000').text(' WASTE MANAGEMENT SERVICES', { align: 'left' });

doc.moveDown();
doc.fontSize(10).text('Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite');
doc.text('Tel. Nos.: (046) 477-0354 • 09173044157');
doc.text('E-mail: cleaneco@cwms.com.ph');
doc.text('Website: www.cwms.com.ph');
doc.moveDown(2);

// Date
doc.text(`Date: ${new Date().toLocaleDateString()}`);
doc.moveDown();

// Attention
doc.font('Helvetica-Bold').text('ATTENTION: All Clients');
doc.font('Helvetica').moveDown(2);

// Content Placeholder replacement
doc.fontSize(14).font('Helvetica-Bold').text('TERMS AND CONDITIONS', { align: 'center' });
doc.moveDown();
doc.fontSize(11).font('Helvetica');

const termsText = `1. Services Provided
Cleaneco Waste Management Services ("Cleaneco") agrees to provide waste collection, declogging, and deep cleaning services as requested by the Client, in compliance with DENR and DOH regulations.

2. Payment Terms
Payments must be settled upon completion of services unless a prior credit arrangement has been established. Late payments may incur an additional 5% penalty charge per month.

3. Client Responsibilities
The Client must ensure that our team has unobstructed access to the premises during the scheduled service time. Any delays caused by restricted access may be subject to additional fees.

4. Liability and Damages
While Cleaneco employs the utmost care in executing its services, we shall not be held liable for any pre-existing damages to plumbing, pipes, or property. Any claims of damage directly caused by our personnel must be reported within 24 hours of service completion.

5. Cancellations and Rescheduling
Cancellations must be made at least 24 hours prior to the scheduled service. Failure to do so will result in a cancellation fee equivalent to 20% of the service cost.

6. Environmental Compliance
We are fully committed to environmentally safe disposal. Hazardous wastes must be declared by the client prior to collection. Cleaneco reserves the right to refuse the collection of undeclared hazardous or toxic materials.`;

doc.text(termsText, { align: 'justify', lineGap: 4 });
doc.moveDown(3);

// Footer / Signature
doc.text('Thank you very much!');
doc.moveDown(2);
doc.text('Very truly yours,');
doc.moveDown(3);
// Pseudo-signature line
doc.text('_____________________________');
doc.text('Jayperson Bonavente');
doc.text('Operation Head');

doc.end();

console.log('tos_sample.pdf generated successfully at', outputPath);
