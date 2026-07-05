<?php
require_once "config.php";
require_once "email_helper.php";

// Add CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Determine content type to parse input
$contentType = isset($_SERVER["CONTENT_TYPE"]) ? trim($_SERVER["CONTENT_TYPE"]) : '';
if (strpos($contentType, 'application/json') !== false) {
    $input = json_decode(file_get_contents("php://input"), true);
} else {
    $input = $_POST;
}

if (!$input) {
    $rawInput = file_get_contents("php://input");
    $debugMessage = "ContentType: " . $contentType . " | POST COUNT: " . count($_POST) . " | FILES COUNT: " . count($_FILES) . " | RAW_LENGTH: " . strlen($rawInput);
    echo json_encode(["success" => false, "message" => "No data received. " . $debugMessage, "debug" => $debugMessage]);
    exit;
}

// Handle different types of submissions
if (isset($input['type'])) {
    switch ($input['type']) {
        case 'register':
            handleRegistration($input, $conn);
            break;
        case 'order':
            handleOrder($input, $conn);
            break;
        case 'service': // ADDED
            handleService($input, $conn);
            break;
        default:
            echo json_encode(["success" => false, "message" => "Invalid submission type"]);
    }
} else {
    echo json_encode(["success" => false, "message" => "Submission type not specified"]);
}

function handleRegistration($data, $conn) {
    $username = $data['username'] ?? '';
    $email = $data['email'] ?? '';
    $password = password_hash($data['password'], PASSWORD_DEFAULT);
    $firstName = $data['firstName'] ?? '';
    $lastName = $data['lastName'] ?? '';
    $phone = $data['phone'] ?? '';
    $address = $data['address'] ?? '';
    $gender = $data['gender'] ?? '';
    $dob = $data['dateOfBirth'] ?? null;

    // Backend Validations
    if (!empty($firstName) && !preg_match("/^[a-zA-Z\s]+$/", $firstName)) {
        echo json_encode(["success" => false, "message" => "First name must contain letters and spaces only."]);
        return;
    }
    if (!empty($lastName) && !preg_match("/^[a-zA-Z\s]+$/", $lastName)) {
        echo json_encode(["success" => false, "message" => "Last name must contain letters and spaces only."]);
        return;
    }
    if (!empty($phone) && !preg_match("/^\(\+63\) [0-9]{3}-[0-9]{3}-[0-9]{4}$/", $phone)) {
        echo json_encode(["success" => false, "message" => "Phone number must be in the format (+63) xxx-xxx-xxxx."]);
        return;
    }
    if (!empty($dob)) {
        $birthTime = strtotime($dob);
        $todayTime = strtotime(date("Y-m-d"));
        
        $age = date('Y', $todayTime) - date('Y', $birthTime);
        if (date('md', $todayTime) < date('md', $birthTime)) {
            $age--;
        }

        if ($birthTime > $todayTime) {
            echo json_encode(["success" => false, "message" => "Date of birth cannot be in the future."]);
            return;
        }
        
        if ($age < 18) {
            echo json_encode(["success" => false, "message" => "You must be at least 18 years old to register."]);
            return;
        }
    }

    // Check if username or email already exists
    $checkStmt = $conn->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $checkStmt->bind_param("ss", $username, $email);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows > 0) {
        echo json_encode(["success" => false, "message" => "Username or email already exists"]);
        $checkStmt->close();
        return;
    }
    $checkStmt->close();

    $stmt = $conn->prepare("INSERT INTO users (username, password, email, first_name, last_name, phone, address, gender, date_of_birth) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    // Handle nullable date
    if (empty($dob)) {
        $dob = null;
    }
    
    $stmt->bind_param("sssssssss", $username, $password, $email, $firstName, $lastName, $phone, $address, $gender, $dob);

    if ($stmt->execute()) {
        $userId = $stmt->insert_id;
        echo json_encode([
            "success" => true, 
            "message" => "Registration successful",
            "userId" => $userId
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Registration failed: " . $conn->error]);
    }
    
    $stmt->close();
}

function handleOrder($data, $conn) {
    // 1. Parse service IDs (can be single service_id, array, or comma separated list)
    $serviceIds = [];
    if (isset($data['service_ids'])) {
        if (is_array($data['service_ids'])) {
            $serviceIds = $data['service_ids'];
        } else {
            $decoded = json_decode($data['service_ids'], true);
            if (is_array($decoded)) {
                $serviceIds = $decoded;
            } else {
                $serviceIds = array_filter(array_map('intval', explode(',', $data['service_ids'])));
            }
        }
    } else {
        $serviceId = intval($data['service_id'] ?? 0);
        if ($serviceId > 0) {
            $serviceIds[] = $serviceId;
        }
    }

    if (empty($serviceIds)) {
        echo json_encode(["success" => false, "message" => "At least one service must be selected."]);
        return;
    }

    // Ensure unique services
    $serviceIds = array_unique($serviceIds);

    // 2. Fetch service details and verify availability
    $idList = implode(',', array_map('intval', $serviceIds));
    $checkServices = $conn->query("SELECT id, name, status, base_price FROM services WHERE id IN ($idList)");

    $servicesMap = [];
    if ($checkServices) {
        while ($row = $checkServices->fetch_assoc()) {
            $servicesMap[$row['id']] = $row;
        }
        $checkServices->close();
    } else {
        echo json_encode(["success" => false, "message" => "Database error fetching services: " . $conn->error]);
        return;
    }

    foreach ($serviceIds as $sId) {
        if (!isset($servicesMap[$sId])) {
            $debugMapKeys = implode(',', array_keys($servicesMap));
            $debugRawInput = $data['service_ids'] ?? 'none';
            echo json_encode(["success" => false, "message" => "Service ID '$sId' not found. Raw input: $debugRawInput. Parsed list: $idList. Available map keys: $debugMapKeys."]);
            return;
        }
        if ($servicesMap[$sId]['status'] !== 'available') {
            echo json_encode(["success" => false, "message" => "Service '" . $servicesMap[$sId]['name'] . "' is currently unavailable."]);
            return;
        }
    }

    // 3. Validate Preferred Inspection Date
    $date = $data['date'] ?? '';
    if (empty($date)) {
        echo json_encode(["success" => false, "message" => "Preferred inspection date is required."]);
        return;
    }

    $bookingTime = strtotime($date);
    $todayTime = strtotime(date("Y-m-d"));
    $minBookingTime = $todayTime + (3 * 24 * 60 * 60); // 3 days in advance
    $maxBookingTime = $todayTime + (30 * 24 * 60 * 60); // 30 days rolling

    if ($bookingTime < $minBookingTime) {
        echo json_encode(["success" => false, "message" => "Preferred inspection date must be at least 3 days in advance."]);
        return;
    }
    if ($bookingTime > $maxBookingTime) {
        echo json_encode(["success" => false, "message" => "Preferred inspection date must be within a rolling 30 days from today (up to " . date("F j, Y", $maxBookingTime) . ")."]);
        return;
    }

    // 4. Validate Booking Limits (Max 3 bookings per day)
    $checkBookings = $conn->prepare("SELECT COUNT(DISTINCT order_id) as count FROM orders WHERE date = ?");
    $checkBookings->bind_param("s", $date);
    $checkBookings->execute();
    $bookingsResult = $checkBookings->get_result()->fetch_assoc();
    $bookingsCount = intval($bookingsResult['count'] ?? 0);
    $checkBookings->close();

    if ($bookingsCount >= 3) {
        echo json_encode(["success" => false, "message" => "Sorry, this date is fully booked. Cleaneco only accepts up to 3 bookings per day."]);
        return;
    }

    $userId = intval($data['user_id'] ?? 0);
    $email = $data['email'] ?? '';

    // 4.5 Validate against booking the same service on the same date
    if (!empty($serviceIds)) {
        $idList = implode(',', array_map('intval', $serviceIds));
        $checkDuplicate = null;
        
        if ($userId > 0) {
            $checkDuplicate = $conn->prepare("SELECT s.name FROM orders o JOIN services s ON o.service_id = s.id WHERE o.user_id = ? AND o.date = ? AND o.service_id IN ($idList) AND o.status != 'Cancelled' LIMIT 1");
            $checkDuplicate->bind_param("is", $userId, $date);
        } else if (!empty($email)) {
            $checkDuplicate = $conn->prepare("SELECT s.name FROM orders o JOIN services s ON o.service_id = s.id WHERE o.email = ? AND o.date = ? AND o.service_id IN ($idList) AND o.status != 'Cancelled' LIMIT 1");
            $checkDuplicate->bind_param("ss", $email, $date);
        }
        
        if ($checkDuplicate) {
            $checkDuplicate->execute();
            $dupResult = $checkDuplicate->get_result();
            if ($dupResult->num_rows > 0) {
                $dupRow = $dupResult->fetch_assoc();
                $checkDuplicate->close();
                echo json_encode(["success" => false, "message" => "You have already booked '" . $dupRow['name'] . "' for this date. If you need it again, please select a different date."]);
                return;
            }
            $checkDuplicate->close();
        }
    }

    // 5. Submit Order Group
    $orderId = 'ORD' . time() . rand(1000, 9999);
    $firstName = $data['firstName'] ?? '';
    $lastName = $data['lastName'] ?? '';
    $phone = $data['phone'] ?? '';
    $address = $data['address'] ?? '';
    $timeSlot = $data['timeSlot'] ?? '';
    $notes = $data['notes'] ?? '';
    $applySeniorDiscount = isset($data['applySeniorDiscount']) && ($data['applySeniorDiscount'] === 'true' || $data['applySeniorDiscount'] === true || $data['applySeniorDiscount'] === 1);
    
    $seniorCardImage = null;

    // Handle file upload if present
    if (isset($_FILES['seniorCardImage']) && $_FILES['seniorCardImage']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../uploads/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        $fileExt = pathinfo($_FILES['seniorCardImage']['name'], PATHINFO_EXTENSION);
        $fileName = 'senior_card_' . time() . '_' . rand(1000, 9999) . '.' . $fileExt;
        $targetFile = $uploadDir . $fileName;
        
        if (move_uploaded_file($_FILES['seniorCardImage']['tmp_name'], $targetFile)) {
            $seniorCardImage = 'uploads/' . $fileName;
        }
    }

    $stmt = $conn->prepare("INSERT INTO orders (order_id, user_id, service_id, first_name, last_name, email, phone, address, service_type, date, time_slot, notes, discount_amount, senior_card_image, tax_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $insertSuccess = true;
    $insertedCount = 0;

    foreach ($serviceIds as $sId) {
        $sName = $servicesMap[$sId]['name'];
        $basePrice = floatval($servicesMap[$sId]['base_price'] ?? 0);
        $discountAmount = 0;
        if ($applySeniorDiscount && $basePrice > 0) {
            $discountAmount = round($basePrice * 0.20, 2);
        }
        $taxAmount = round($basePrice * 0.10, 2);
        
        $stmt->bind_param("siisssssssssdsd", $orderId, $userId, $sId, $firstName, $lastName, $email, $phone, $address, $sName, $date, $timeSlot, $notes, $discountAmount, $seniorCardImage, $taxAmount);
        
        if (!$stmt->execute()) {
            $insertSuccess = false;
            break;
        }
        $insertedCount++;
    }
    $stmt->close();

    if ($insertSuccess && $insertedCount > 0) {
        // Create Admin Notification
        $serviceNames = [];
        foreach ($serviceIds as $sId) {
            $serviceNames[] = $servicesMap[$sId]['name'];
        }
        $servicesStr = implode(", ", $serviceNames);
        
        $notifMsg = "New booking from {$firstName} {$lastName} (#{$orderId})";
        $notifDetails = "Services: {$servicesStr} on " . date("M d, Y", strtotime($date)) . " ({$timeSlot})";
        
        $notifStmt = $conn->prepare("INSERT INTO notifications (order_id, message, details) VALUES (?, ?, ?)");
        $notifStmt->bind_param("sss", $orderId, $notifMsg, $notifDetails);
        $notifStmt->execute();
        $notifStmt->close();

        // Send Confirmation Email
        sendConfirmationEmail($orderId, $conn);

        echo json_encode(["success" => true, "message" => "Order submitted successfully", "order_id" => $orderId]);
    } else {
        echo json_encode(["success" => false, "message" => "Order submission failed: " . $conn->error]);
    }
}

// ADDED: Service handling function
function handleService($data, $conn) {
    $name = $data['name'] ?? '';
    $description = $data['description'] ?? '';
    $base_price = $data['base_price'] ?? 0;
    $status = $data['status'] ?? 'available';
    
    $stmt = $conn->prepare("INSERT INTO services (name, description, base_price, status) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssds", $name, $description, $base_price, $status);
    
    if ($stmt->execute()) {
        echo json_encode([
            "success" => true, 
            "message" => "Service added successfully",
            "id" => $stmt->insert_id
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to add service: " . $conn->error]);
    }
    
    $stmt->close();
}

$conn->close();