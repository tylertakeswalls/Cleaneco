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
            <img src="https://cleaneco-kappa.vercel.app/logo_fixed.png" alt="Cleaneco Logo" />
            ${title ? `<h1>${title}</h1>` : `<h1>Cleaneco Waste Management</h1>`}
            <p>${headerSubtitle}</p>
        </div>
        <div class='content'>
            ${contentHtml}
        </div>
        <div class='footer'>
            <p>&copy; ${new Date().getFullYear()} Cleaneco Waste Management Services. All rights reserved.</p>
            <p>For inquiries, please contact us at cleanecowmss@gmail.com or +63 9216214712.</p>
        </div>
    </div>
</body>
</html>
`;

const sendEmailJS = async (templateId, templateParams) => {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const userId = process.env.EMAILJS_USER_ID;
  const accessToken = process.env.EMAILJS_ACCESS_TOKEN;

  if (!serviceId || !userId || !accessToken) {
    console.error('EmailJS configuration error: Missing EMAILJS_SERVICE_ID, EMAILJS_USER_ID, or EMAILJS_ACCESS_TOKEN environment variables.');
    throw new Error('Email service configuration missing on server.');
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: userId,
    accessToken: accessToken,
    template_params: templateParams
  };

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`EmailJS Error: ${response.status} ${text}`);
      throw new Error(`EmailJS Error: ${response.status} ${text}`);
    }
    
    console.log(`Email successfully sent via EmailJS (Template: ${templateId})`);
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error; // Rethrow to let the caller handle it
  }
};

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

  // Template 2: Universal Client Template
  await sendEmailJS('template_ns5zlcs', {
    to_email: clientInfo.email,
    subject: subject,
    html_content: htmlMessage
  });
};

const sendVerificationEmail = async (email, token, firstName) => {
  const verificationLink = `${process.env.CLIENT_URL || 'https://cleaneco-kappa.vercel.app'}/verify?token=${token}`;
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
      title: 'Cleaneco Waste Management Services',
      headerSubtitle: "Account Verification",
      contentHtml
  });

  // Template 2: Universal Client Template
  await sendEmailJS('template_ns5zlcs', {
    to_email: email,
    subject: subject,
    html_content: htmlMessage
  });
};

const sendContactEmail = async (name, email, subject, message) => {
  const contentHtml = `
      <h2 class='section-title'>New ${subject} Submission</h2>
      <div class='grid'>
          <div class='grid-col'>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Subject:</strong> ${subject}</p>
          </div>
      </div>
      
      <h2 class='section-title'>Message</h2>
      <div class='notes-box'>
          ${message.replace(/\n/g, '<br>')}
      </div>
  `;

  const htmlMessage = baseEmailTemplate({
      subject: `New Contact Submission: ${subject}`,
      title: 'Cleaneco Website Contact Form',
      headerSubtitle: "New Message Received",
      contentHtml
  });

  // Template 1: Contact Form
  await sendEmailJS('template_kg1a2go', {
    name: name,
    subject: subject,
    reply_to: email,
    html_content: htmlMessage
  });
};

const sendRescheduleEmail = async (email, firstName, orderId, isApproved, newDate, newTime, rejectReason) => {
  const subject = isApproved ? `Cleaneco Order #${orderId} Reschedule Approved` : `Cleaneco Order #${orderId} Reschedule Rejected`;
  const headerSubtitle = "Reschedule Request Update";
  const statusColor = isApproved ? '#0D8D1E' : '#dc3545';
  
  const contentHtml = `
      <div class='status-banner' style='border-left: 4px solid ${statusColor};'>
          <p>Hi ${firstName},</p>
          <p style='margin-top: 8px;'>Your request to reschedule Order #${orderId} has been <strong>${isApproved ? 'approved' : 'rejected'}</strong>.</p>
      </div>
      
      ${isApproved ? `
      <h2 class='section-title'>New Schedule</h2>
      <div class='grid'>
          <div class='grid-col'>
              <p><strong>New Date:</strong> ${new Date(newDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              <p><strong>New Time Slot:</strong> ${newTime}</p>
          </div>
      </div>
      ` : `
      <h2 class='section-title'>Rejection Reason</h2>
      <div class='notes-box'>
          ${rejectReason ? rejectReason.replace(/\n/g, '<br>') : 'Unfortunately, we are unable to accommodate the requested schedule at this time.'}
      </div>
      <p style="font-size: 14px; margin-top: 15px; color: #475569;">Your original schedule remains unchanged.</p>
      `}
  `;

  const htmlMessage = baseEmailTemplate({
      subject,
      title: 'Cleaneco Waste Management Services',
      headerSubtitle,
      contentHtml
  });

  await sendEmailJS('template_ns5zlcs', {
    to_email: email,
    subject: subject,
    html_content: htmlMessage
  });
};

const sendPasswordResetEmail = async (email, token, firstName) => {
  const clientBaseUrl = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://cleaneco-kappa.vercel.app' : 'http://localhost:3000');
  const resetLink = `${clientBaseUrl}/reset-password?token=${token}`;
  const subject = 'Reset Your Cleaneco Account Password';
  
  const contentHtml = `
      <div style="text-align: center;">
          <h2 style="color: #1e293b; margin-top: 0; font-size: 22px;">Hello ${firstName || 'Valued Client'},</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
              We received a request to reset the password for your Cleaneco account. Click the button below to create a new password:
          </p>
          <a href='${resetLink}' class='btn-action' style='color: #ffffff; text-decoration: none;'>Reset My Password</a>
          <div class="notes-box" style="margin-top: 25px; text-align: left;">
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                  <strong>Note:</strong> This password reset link will expire in <strong>1 hour</strong>. If you did not request this password reset, please ignore this email or contact support if you suspect unauthorized access.
              </p>
          </div>
          <p style="font-size: 13px; margin-top: 20px; color: #94a3b8; text-align: left;">
              If the button above does not work, copy and paste this link into your browser:<br><br>
              <a href='${resetLink}' style='color: ${primaryColor}; word-break: break-all;'>${resetLink}</a>
          </p>
      </div>
  `;

  const htmlMessage = baseEmailTemplate({
      subject,
      title: 'Cleaneco Waste Management Services',
      headerSubtitle: "Password Reset Request",
      contentHtml
  });

  await sendEmailJS('template_ns5zlcs', {
    to_email: email,
    subject: subject,
    html_content: htmlMessage
  });
};

const sendPaymentReminderEmail = async (orderId, clientInfo, balanceDue, daysOverdue = 0) => {
  const portalLink = `${process.env.CLIENT_URL || 'https://cleaneco-kappa.vercel.app'}/orders`;
  const subject = `Payment Reminder: Outstanding Balance for Cleaneco Order #${orderId}`;
  const headerSubtitle = "Final Payment Balance Reminder";
  const formattedBalance = `₱${parseFloat(balanceDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const contentHtml = `
      <div class='status-banner' style='border-left: 4px solid #ef4444; background-color: #fef2f2;'>
          <p style='color: #991b1b; font-weight: 600; font-size: 16px; margin-bottom: 6px;'>
              Outstanding Balance Notice
          </p>
          <p style='color: #4b5563; margin: 0; font-size: 14px;'>
              Dear ${clientInfo.firstName || 'Valued Client'}, our field operations team has completed your scheduled service for <strong>Order #${orderId}</strong>. Records indicate that the remaining final balance of <strong style='color: #0D8D1E;'>${formattedBalance}</strong> is currently pending settlement.
          </p>
      </div>

      <h2 class='section-title'>Order & Account Summary</h2>
      <div class='grid'>
          <div class='grid-col'>
              <p><strong>Order ID:</strong> #${orderId}</p>
              <p><strong>Service Type:</strong> ${clientInfo.serviceType || 'Sanitation / Desludging'}</p>
              <p><strong>Service Status:</strong> <span style='color: #0D8D1E; font-weight: bold;'>Completed</span></p>
              <p><strong>Completed:</strong> ${daysOverdue > 0 ? `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} ago` : 'Recently completed'}</p>
          </div>
          <div class='grid-col'>
              <p><strong>Client Name:</strong> ${clientInfo.firstName} ${clientInfo.lastName}</p>
              <p><strong>Address:</strong> ${clientInfo.address || 'On Record'}</p>
              <p><strong>Outstanding Balance:</strong> <span style='color: #ef4444; font-weight: 700; font-size: 16px;'>${formattedBalance}</span></p>
          </div>
      </div>

      <div style="text-align: center; margin: 25px 0;">
          <a href='${portalLink}' class='btn-action' style='color: #ffffff; text-decoration: none;'>View Order & Settle Balance</a>
          <p style="font-size: 13px; color: #64748b; margin-top: 10px;">
              You may settle via online payment gateway or upload an official post-dated / manager's cheque directly in your portal.
          </p>
      </div>

      <div class="notes-box">
          <p style="margin: 0; font-size: 13px; color: #64748b;">
              <strong>Note:</strong> If you have already remitted this payment or submitted a cheque that is currently pending verification, please disregard this reminder. For assistance or questions regarding your invoice, feel free to contact our billing team at cleanecowmss@gmail.com or +63 9216214712.
          </p>
      </div>
  `;

  const htmlMessage = baseEmailTemplate({
      subject,
      title: 'Cleaneco Waste Management Services',
      headerSubtitle,
      contentHtml
  });

  await sendEmailJS('template_ns5zlcs', {
    to_email: clientInfo.email,
    subject: subject,
    html_content: htmlMessage
  });
};

const sendServiceDueReminderEmail = async (orderId, clientInfo, dueDate, serviceName) => {
  const portalLink = `${process.env.CLIENT_URL || 'https://cleaneco-kappa.vercel.app'}/orders`;
  const subject = `Maintenance Due: Recommended ${serviceName || 'Service'} Reminder for Order #${orderId}`;
  const headerSubtitle = "Recurring Maintenance Reminder";
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Soon';

  const contentHtml = `
      <div class='status-banner' style='border-left: 4px solid #0D8D1E; background-color: #f0fdf4;'>
          <p style='color: #065f46; font-weight: 600; font-size: 16px; margin-bottom: 6px;'>
              Recommended Service Maintenance Due
          </p>
          <p style='color: #4b5563; margin: 0; font-size: 14px;'>
              Dear ${clientInfo.firstName || 'Valued Client'}, based on recommended environmental and sanitation guidelines, your scheduled service for <strong>${serviceName || 'waste management'}</strong> (Order #${orderId}) is approaching its recommended maintenance cycle on <strong>${formattedDueDate}</strong>.
          </p>
      </div>

      <h2 class='section-title'>Maintenance Details</h2>
      <div class='grid'>
          <div class='grid-col'>
              <p><strong>Service Type:</strong> ${serviceName || 'Siphoning / Desludging'}</p>
              <p><strong>Previous Order:</strong> #${orderId}</p>
              <p><strong>Recommended Due Date:</strong> <span style='color: #0D8D1E; font-weight: bold;'>${formattedDueDate}</span></p>
          </div>
          <div class='grid-col'>
              <p><strong>Client:</strong> ${clientInfo.firstName} ${clientInfo.lastName}</p>
              <p><strong>Service Address:</strong> ${clientInfo.address || 'Address on record'}</p>
          </div>
      </div>

      <div style="text-align: center; margin: 25px 0;">
          <a href='${portalLink}' class='btn-action' style='color: #ffffff; text-decoration: none;'>Book Again & Reserve Date</a>
          <p style="font-size: 13px; color: #64748b; margin-top: 10px;">
              Regular maintenance prevents plumbing emergencies, overflows, and costly system damages.
          </p>
      </div>

      <div class="notes-box">
          <p style="margin: 0; font-size: 13px; color: #64748b;">
              Need help scheduling or have inquiries regarding your service frequency? Contact our team at cleanecowmss@gmail.com or +63 9216214712.
          </p>
      </div>
  `;

  const htmlMessage = baseEmailTemplate({
      subject,
      title: 'Cleaneco Waste Management Services',
      headerSubtitle,
      contentHtml
  });

  await sendEmailJS('template_ns5zlcs', {
    to_email: clientInfo.email,
    subject: subject,
    html_content: htmlMessage
  });
};

const sendCashPaymentSettlementEmail = async (orderId, clientInfo, amountPaid, receiptNo, receivedBy) => {
  const portalLink = `${process.env.CLIENT_URL || 'https://cleaneco-kappa.vercel.app'}/orders`;
  const subject = `Official Settlement Receipt: Cash Payment Confirmed for Order #${orderId}`;
  const headerSubtitle = "Payment Receipt & Settlement Confirmation";
  const formattedAmount = typeof amountPaid === 'number'
    ? `₱${amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `₱${amountPaid}`;

  const contentHtml = `
      <div class='status-banner' style='border-left: 4px solid #0D8D1E; background-color: #f0fdf4;'>
          <p style='color: #065f46; font-weight: 600; font-size: 16px; margin-bottom: 6px;'>
              Payment Acknowledged & Settled in Full
          </p>
          <p style='color: #4b5563; margin: 0; font-size: 14px;'>
              Dear ${clientInfo.firstName || 'Valued Client'}, this email confirms that your cash settlement of <strong style='color: #0D8D1E;'>${formattedAmount}</strong> for <strong>Order #${orderId}</strong> has been received, verified, and officially recorded. Your account is now fully settled.
          </p>
      </div>

      <h2 class='section-title'>Settlement Summary</h2>
      <div class='grid'>
          <div class='grid-col'>
              <p><strong>Order ID:</strong> #${orderId}</p>
              <p><strong>Payment Method:</strong> <span style='color: #0D8D1E; font-weight: bold;'>Cash (On-Site)</span></p>
              <p><strong>Amount Settled:</strong> <span style='font-weight: 700; color: #0D8D1E;'>${formattedAmount}</span></p>
              ${receiptNo ? `<p><strong>Official Receipt / Ref No:</strong> ${receiptNo}</p>` : ''}
          </div>
          <div class='grid-col'>
              <p><strong>Client Name:</strong> ${clientInfo.firstName} ${clientInfo.lastName}</p>
              <p><strong>Service Address:</strong> ${clientInfo.address || 'On Record'}</p>
              <p><strong>Received / Handled By:</strong> ${receivedBy || 'Field Crew / Office Cashier'}</p>
              <p><strong>Date Settled:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
      </div>

      <div style="text-align: center; margin: 25px 0;">
          <a href='${portalLink}' class='btn-action' style='color: #ffffff; text-decoration: none;'>View Settled Order</a>
          <p style="font-size: 13px; color: #64748b; margin-top: 10px;">
              Thank you for trusting Cleaneco for your sanitation and waste management needs!
          </p>
      </div>

      <div class="notes-box">
          <p style="margin: 0; font-size: 13px; color: #64748b;">
              <strong>Note:</strong> Please retain this email or your physical collection receipt for your accounting and sanitation compliance records. For billing inquiries, contact us at cleanecowmss@gmail.com or +63 9216214712.
          </p>
      </div>
  `;

  const htmlMessage = baseEmailTemplate({
      subject,
      title: 'Cleaneco Waste Management Services',
      headerSubtitle,
      contentHtml
  });

  await sendEmailJS('template_ns5zlcs', {
    to_email: clientInfo.email,
    subject: subject,
    html_content: htmlMessage
  });
};

module.exports = { 
  sendConfirmationEmail, 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendContactEmail, 
  sendRescheduleEmail,
  sendPaymentReminderEmail,
  sendServiceDueReminderEmail,
  sendCashPaymentSettlementEmail
};
