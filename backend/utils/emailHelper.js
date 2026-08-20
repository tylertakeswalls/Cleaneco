const nodemailer = require('nodemailer');
const path = require('path');

const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to your email service provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const primaryColor = '#0D8D1E';

const baseEmailTemplate = ({ subject, title, headerSubtitle, contentHtml }) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>${subject}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #333333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, ${primaryColor} 0%, #085a13 100%); padding: 30px; text-align: center; color: #ffffff; }
        .header img { height: 60px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 5px 0 0 0; font-size: 16px; opacity: 0.9; font-weight: 500; }
        .content { padding: 30px; }
        .status-banner { background-color: #f1f5f9; padding: 15px; border-radius: 4px; margin-bottom: 25px; }
        .status-banner p { margin: 0; font-size: 15px; line-height: 1.5; }
        .section-title { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-top: 0; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 5px; }
        .grid { display: flex; flex-wrap: wrap; margin-bottom: 25px; }
        .grid-col { flex: 1; min-width: 250px; margin-bottom: 15px; }
        .grid-col p { margin: 4px 0; font-size: 14px; }
        .grid-col strong { color: #475569; }
        .table-container { margin-bottom: 25px; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { background-color: #f8fafc; color: #475569; padding: 12px; font-size: 13px; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
        .totals-row td { border-bottom: none; padding-top: 8px; padding-bottom: 8px; }
        .totals-row.grand-total td { border-top: 2px solid #e2e8f0; font-weight: 700; font-size: 16px; color: ${primaryColor}; }
        .notes-box { background-color: #f8fafc; border-radius: 6px; padding: 15px; font-size: 13px; color: #475569; border: 1px dashed #e2e8f0; margin-bottom: 25px; }
        .btn-action { display: inline-block; background-color: ${primaryColor}; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 25px 0; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 5px 0; }
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            ${title ? `<h1>${title}</h1>` : `<img src="cid:cleanecologo" alt="Cleaneco Logo" />`}
            <p>${headerSubtitle}</p>
        </div>
        <div class='content'>
            ${contentHtml}
        </div>
        <div class='footer'>
            <p>&copy; ${new Date().getFullYear()} Cleaneco Waste Management Services. All rights reserved.</p>
            <p>For inquiries, please contact us at support@cleaneco.com or +63 9216214712.</p>
        </div>
    </div>
</body>
</html>
`;

const sendConfirmationEmail = async (orderId, clientInfo, orderItems, statusChange = false) => {
  let totalPrice = 0;
  let itemsHtml = '';
  
  orderItems.forEach(item => {
    const itemPrice = item.price !== null && item.price !== undefined ? parseFloat(item.price) : parseFloat(item.base_price || 0);
    totalPrice += itemPrice;
    itemsHtml += `
      <tr>
          <td>${item.service_name}</td>
          <td style='text-align: right;'>₱${itemPrice.toFixed(2)}</td>
      </tr>`;
  });

  let statusColor = '#ffc107'; // Yellow for Pending
  if (clientInfo.status === 'In Progress') statusColor = '#007bff';
  if (clientInfo.status === 'Completed') statusColor = '#0D8D1E';
  if (clientInfo.status === 'Cancelled') statusColor = '#dc3545';

  const subject = statusChange
    ? `Cleaneco Order #${orderId} Status Updated: ${clientInfo.status}`
    : `Cleaneco Order #${orderId} Received - Pending Confirmation`;

  const headerSubtitle = statusChange ? "Order Status Update" : "Order Confirmation Receipt";
  const statusDesc = statusChange
    ? `Your order status has been updated to <strong>${clientInfo.status}</strong>.`
    : "Thank you for placing an order with Cleaneco! Your order is currently pending review by our administrator.";

  const contentHtml = `
      <div class='status-banner' style='border-left: 4px solid ${statusColor};'>
          <p>${statusDesc}</p>
          <p style='margin-top: 8px;'>Current Status: <span style='color: ${statusColor}; font-weight: bold;'>${clientInfo.status}</span></p>
      </div>
      
      <h2 class='section-title'>Order Info</h2>
      <div class='grid'>
          <div class='grid-col'>
              <p><strong>Order ID:</strong> #${orderId}</p>
              <p><strong>Preferred Date:</strong> ${new Date(clientInfo.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p><strong>Time Slot:</strong> ${clientInfo.timeSlot}</p>
          </div>
          <div class='grid-col'>
              <p><strong>Customer:</strong> ${clientInfo.firstName} ${clientInfo.lastName}</p>
              <p><strong>Phone:</strong> ${clientInfo.phone}</p>
              <p><strong>Address:</strong> ${clientInfo.address}</p>
          </div>
      </div>
      
      <h2 class='section-title'>Services Ordered</h2>
      <div class='table-container'>
          <table>
              <thead>
                  <tr>
                      <th>Service Name</th>
                      <th style='text-align: right;'>Price</th>
                  </tr>
              </thead>
              <tbody>
                  ${itemsHtml}
                  <tr class='totals-row grand-total' style='margin-top: 15px;'>
                      <td style='text-align: right;'>Total Price:</td>
                      <td style='text-align: right;'>₱${totalPrice.toFixed(2)}</td>
                  </tr>
              </tbody>
          </table>
      </div>
      
      ${clientInfo.notes ? `
      <h2 class='section-title'>Additional Notes</h2>
      <div class='notes-box'>
          ${clientInfo.notes.replace(/\n/g, '<br>')}
      </div>` : ''}
  `;

  const htmlMessage = baseEmailTemplate({
      subject,
      title: 'Cleaneco Waste Management Services',
      headerSubtitle,
      contentHtml
  });

  const mailOptions = {
    from: '"Cleaneco Waste Management Services" <noreply@cleaneco.com>',
    to: clientInfo.email,
    subject: subject,
    html: htmlMessage,
    attachments: [{
      filename: 'logo_fixed.png',
      path: path.join(__dirname, '../../src/assets/styles/images/logo_fixed.png'),
      cid: 'cleanecologo'
    }]
  };

  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail(mailOptions);
      console.log(`Confirmation email sent to ${clientInfo.email}`);
    } else {
      console.log(`[DEV] Email would be sent to ${clientInfo.email} with subject: ${subject}`);
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

const sendVerificationEmail = async (email, token, firstName) => {
  const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify?token=${token}`;
  const subject = 'Verify Your Cleaneco Account';
  
  const contentHtml = `
      <div style="text-align: center;">
          <h2>Welcome to Cleaneco Waste Management Services, ${firstName}!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">Thank you for registering. Please confirm your email address to activate your account and start booking our services.</p>
          <a href='${verificationLink}' class='btn-action' style='color: white;'>Verify Email Address</a>
          <p style="font-size: 14px; margin-top: 20px; color: #475569;">If the button above does not work, copy and paste the following link into your browser:<br><br><a href='${verificationLink}' style='color: ${primaryColor}; word-break: break-all;'>${verificationLink}</a></p>
      </div>
  `;

  const htmlMessage = baseEmailTemplate({
      subject,
      title: null, // use logo
      headerSubtitle: "Account Verification",
      contentHtml
  });

  const mailOptions = {
    from: '"Cleaneco Waste Management Services" <noreply@cleaneco.com>',
    to: email,
    subject: subject,
    html: htmlMessage,
    attachments: [{
      filename: 'logo_fixed.png',
      path: path.join(__dirname, '../../src/assets/styles/images/logo_fixed.png'),
      cid: 'cleanecologo'
    }]
  };

  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS && !process.env.EMAIL_USER.includes('your_email')) {
      await transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
    } else {
      console.log(`[DEV] Verification email would be sent to ${email} with link: ${verificationLink}`);
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
  }
};

module.exports = { sendConfirmationEmail, sendVerificationEmail };
