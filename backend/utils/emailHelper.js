const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to your email service provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendConfirmationEmail = async (orderId, clientInfo, orderItems, statusChange = false) => {
  let totalPrice = 0;
  let totalDiscount = 0;

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

  const finalTotal = Math.max(0, totalPrice - totalDiscount);

  const primaryColor = '#0D8D1E';
  let statusColor = '#ffc107'; // Yellow for Pending
  if (clientInfo.status === 'In Progress') statusColor = '#007bff';
  if (clientInfo.status === 'Completed') statusColor = '#0D8D1E';
  if (clientInfo.status === 'Cancelled') statusColor = '#dc3545';

  const subject = statusChange
    ? `Cleaneco Order #${orderId} Status Updated: ${clientInfo.status}`
    : `Cleaneco Order #${orderId} Received - Pending Confirmation`;

  const statusTitle = statusChange ? "Order Status Update" : "Order Confirmation Receipt";
  const statusDesc = statusChange
    ? `Your order status has been updated to <strong>${clientInfo.status}</strong>.`
    : "Thank you for placing an order with Cleaneco! Your order is currently pending review by our administrator.";

  const htmlMessage = `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset='utf-8'>
      <title>${subject}</title>
      <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #333333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, ${primaryColor} 0%, #085a13 100%); padding: 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 30px; }
          .status-banner { background-color: #f1f5f9; border-left: 4px solid ${statusColor}; padding: 15px; border-radius: 4px; margin-bottom: 25px; }
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
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
          .footer p { margin: 5px 0; }
      </style>
  </head>
  <body>
      <div class='container'>
          <div class='header'>
              <h1>Cleaneco Waste Management Services</h1>
              <p>${statusTitle}</p>
          </div>
          
          <div class='content'>
              <div class='status-banner'>
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
                          <tr class='totals-row' style='margin-top: 15px;'>
                              <td style='text-align: right; font-weight: bold;'>Subtotal:</td>
                              <td style='text-align: right;'>₱${totalPrice.toFixed(2)}</td>
                          </tr>
                          <tr class='totals-row grand-total'>
                              <td style='text-align: right;'>Total Price:</td>
                              <td style='text-align: right;'>₱${finalTotal.toFixed(2)}</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              
              ${clientInfo.notes ? `
              <h2 class='section-title'>Additional Notes</h2>
              <div class='notes-box'>
                  ${clientInfo.notes.replace(/\n/g, '<br>')}
              </div>` : ''}
              
          </div>
          
          <div class='footer'>
              <p>&copy; ${new Date().getFullYear()} Cleaneco Septic Tank Services. All rights reserved.</p>
              <p>For inquiries, please contact us at support@cleaneco.com or +63 9216214712.</p>
          </div>
      </div>
  </body>
  </html>
  `;

  const mailOptions = {
    from: '"Cleaneco Services" <noreply@cleaneco.com>',
    to: clientInfo.email,
    subject: subject,
    html: htmlMessage
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
  const verificationLink = `http://localhost:3000/verify?token=${token}`;
  const subject = 'Verify Your Cleaneco Account';
  const primaryColor = '#0D8D1E';

  const htmlMessage = `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset='utf-8'>
      <title>${subject}</title>
      <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #333333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, ${primaryColor} 0%, #085a13 100%); padding: 30px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 30px; text-align: center; }
          .content p { font-size: 16px; line-height: 1.6; color: #475569; }
          .btn-verify { display: inline-block; background-color: ${primaryColor}; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 25px 0; }
          .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
  </head>
  <body>
      <div class='container'>
          <div class='header'>
              <h1>CLEANECO</h1>
              <p>Account Verification</p>
          </div>
          <div class='content'>
              <h2>Welcome to Cleaneco, ${firstName}!</h2>
              <p>Thank you for registering. Please confirm your email address to activate your account and start booking our services.</p>
              <a href='${verificationLink}' class='btn-verify' style='color: white;'>Verify Email Address</a>
              <p style="font-size: 14px; margin-top: 20px;">If the button above does not work, copy and paste the following link into your browser:<br><br><a href='${verificationLink}' style='color: ${primaryColor}; word-break: break-all;'>${verificationLink}</a></p>
          </div>
          <div class='footer'>
              <p>&copy; ${new Date().getFullYear()} Cleaneco Septic Tank Services. All rights reserved.</p>
              <p>If you did not request this account, please ignore this email.</p>
          </div>
      </div>
  </body>
  </html>
  `;

  const mailOptions = {
    from: '"Cleaneco Services" <noreply@cleaneco.com>',
    to: email,
    subject: subject,
    html: htmlMessage
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
