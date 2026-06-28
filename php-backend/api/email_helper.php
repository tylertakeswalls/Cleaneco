<?php
// PHP helper to format and send order confirmation emails, with fallback file logging

function sendConfirmationEmail($orderId, $conn, $statusChange = false) {
    // 1. Fetch order details from database
    $stmt = $conn->prepare("
        SELECT o.*, s.name as service_name, s.base_price, u.first_name as user_fname, u.last_name as user_lname
        FROM orders o
        LEFT JOIN services s ON o.service_id = s.id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.order_id = ?
    ");
    $stmt->bind_param("s", $orderId);
    $stmt->execute();
    $result = $stmt->get_result();

    $orderItems = [];
    $clientInfo = null;
    $totalPrice = 0;
    $totalDiscount = 0;

    while ($row = $result->fetch_assoc()) {
        $orderItems[] = $row;
        if (!$clientInfo) {
            $clientInfo = [
                'firstName' => $row['first_name'],
                'lastName' => $row['last_name'],
                'email' => $row['email'],
                'phone' => $row['phone'],
                'address' => $row['address'],
                'date' => $row['date'],
                'timeSlot' => $row['time_slot'],
                'status' => $row['status'],
                'notes' => $row['notes'],
                'seniorCardImage' => $row['senior_card_image']
            ];
        }
        $basePrice = floatval($row['base_price'] ?? 0);
        // If an explicit price has been updated by admin, use it, else use base price
        $priceVal = ($row['price'] !== null) ? floatval($row['price']) : $basePrice;
        $totalPrice += $priceVal;
        $totalDiscount += floatval($row['discount_amount'] ?? 0);
    }
    $stmt->close();

    if (empty($orderItems) || !$clientInfo) {
        return false;
    }

    $finalTotal = max(0, $totalPrice - $totalDiscount);

    // 2. Define colors and layout matching Cleaneco branding
    $primaryColor = '#0D8D1E';
    $statusColor = '#ffc107'; // Yellow for Pending
    if ($clientInfo['status'] === 'In Progress') $statusColor = '#007bff';
    if ($clientInfo['status'] === 'Completed') $statusColor = '#0D8D1E';
    if ($clientInfo['status'] === 'Cancelled') $statusColor = '#dc3545';

    $subject = $statusChange 
        ? "Cleaneco Order #{$orderId} Status Updated: {$clientInfo['status']}"
        : "Cleaneco Order #{$orderId} Received - Pending Confirmation";

    $statusTitle = $statusChange ? "Order Status Update" : "Order Confirmation Receipt";
    $statusDesc = $statusChange 
        ? "Your order status has been updated to <strong>{$clientInfo['status']}</strong>."
        : "Thank you for placing an order with Cleaneco! Your order is currently pending review by our administrator.";

    // 3. Build HTML body
    $htmlMessage = "
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='utf-8'>
        <title>{$subject}</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #333333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
            .header { background: linear-gradient(135deg, {$primaryColor} 0%, #085a13 100%); padding: 30px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
            .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
            .content { padding: 30px; }
            .status-banner { background-color: #f1f5f9; border-left: 4px solid {$statusColor}; padding: 15px; border-radius: 4px; margin-bottom: 25px; }
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
            .totals-row.grand-total td { border-top: 2px solid #e2e8f0; font-weight: 700; font-size: 16px; color: {$primaryColor}; }
            .notes-box { background-color: #f8fafc; border-radius: 6px; padding: 15px; font-size: 13px; color: #475569; border: 1px dashed #e2e8f0; margin-bottom: 25px; }
            .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
            .footer p { margin: 5px 0; }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>CLEANECO</h1>
                <p>{$statusTitle}</p>
            </div>
            
            <div class='content'>
                <div class='status-banner'>
                    <p>{$statusDesc}</p>
                    <p style='margin-top: 8px;'>Current Status: <span style='color: {$statusColor}; font-weight: bold;'>{$clientInfo['status']}</span></p>
                </div>
                
                <h2 class='section-title'>Order Info</h2>
                <div class='grid'>
                    <div class='grid-col'>
                        <p><strong>Order ID:</strong> #{$orderId}</p>
                        <p><strong>Preferred Date:</strong> " . date("F j, Y", strtotime($clientInfo['date'])) . "</p>
                        <p><strong>Time Slot:</strong> {$clientInfo['timeSlot']}</p>
                    </div>
                    <div class='grid-col'>
                        <p><strong>Customer:</strong> {$clientInfo['firstName']} {$clientInfo['lastName']}</p>
                        <p><strong>Phone:</strong> {$clientInfo['phone']}</p>
                        <p><strong>Address:</strong> {$clientInfo['address']}</p>
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
                        <tbody>";
                        
                        foreach ($orderItems as $item) {
                            $itemPrice = ($item['price'] !== null) ? floatval($item['price']) : floatval($item['base_price'] ?? 0);
                            $htmlMessage .= "
                            <tr>
                                <td>{$item['service_name']}</td>
                                <td style='text-align: right;'>₱" . number_format($itemPrice, 2) . "</td>
                            </tr>";
                        }
                        
                        $htmlMessage .= "
                            <tr class='totals-row' style='margin-top: 15px;'>
                                <td style='text-align: right; font-weight: bold;'>Subtotal:</td>
                                <td style='text-align: right;'>₱" . number_format($totalPrice, 2) . "</td>
                            </tr>";
                            
                        if ($totalDiscount > 0) {
                            $htmlMessage .= "
                            <tr class='totals-row'>
                                <td style='text-align: right; font-weight: bold; color: #dc3545;'>Senior Citizen Discount (20%):</td>
                                <td style='text-align: right; color: #dc3545;'>-₱" . number_format($totalDiscount, 2) . "</td>
                            </tr>";
                        }

                        $htmlMessage .= "
                            <tr class='totals-row grand-total'>
                                <td style='text-align: right;'>Total Price:</td>
                                <td style='text-align: right;'>₱" . number_format($finalTotal, 2) . "</td>
                            </tr>
                        </tbody>
                    </table>
                </div>";
                
                if (!empty($clientInfo['notes'])) {
                    $htmlMessage .= "
                    <h2 class='section-title'>Additional Notes</h2>
                    <div class='notes-box'>
                        " . nl2br(htmlspecialchars($clientInfo['notes'])) . "
                    </div>";
                }
                
    $htmlMessage .= "
            </div>
            
            <div class='footer'>
                <p>&copy; " . date("Y") . " Cleaneco Septic Tank Services. All rights reserved.</p>
                <p>For inquiries, please contact us at support@cleaneco.com or +63 9216214712.</p>
            </div>
        </div>
    </body>
    </html>
    ";

    // 4. Send email using standard PHP mail()
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: Cleaneco Services <noreply@cleaneco.com>" . "\r\n";

    $mailSent = @mail($clientInfo['email'], $subject, $htmlMessage, $headers);

    // 5. Fallback File Logging for local dev environment verification
    $logDir = dirname(__DIR__) . '/uploads';
    if (!file_exists($logDir)) {
        @mkdir($logDir, 0777, true);
    }
    
    $logFile = $logDir . '/emails_sent.log';
    $logEntry = "========================================================================\n";
    $logEntry .= "TIMESTAMP: " . date("Y-m-d H:i:s") . "\n";
    $logEntry .= "TO: " . $clientInfo['email'] . "\n";
    $logEntry .= "SUBJECT: " . $subject . "\n";
    $logEntry .= "MAIL SENT VIA PHP mail(): " . ($mailSent ? "SUCCESS" : "FAILED / NO SMTP") . "\n";
    $logEntry .= "------------------------------------------------------------------------\n";
    $logEntry .= $htmlMessage . "\n";
    $logEntry .= "========================================================================\n\n";

    @file_put_contents($logFile, $logEntry, FILE_APPEND);

    return true;
}
