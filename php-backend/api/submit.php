<?php
require_once "config.php";

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
    // Check if service is available
    $serviceId = $data['service_id'] ?? 0;
    $checkService = $conn->prepare("SELECT status FROM services WHERE id = ?");
    $checkService->bind_param("i", $serviceId);
    $checkService->execute();
    $serviceResult = $checkService->get_result();
    
    if ($serviceResult->num_rows === 0) {
        echo json_encode(["success" => false, "message" => "Service not found"]);
        $checkService->close();
        return;
    }
    
    $service = $serviceResult->fetch_assoc();
    if ($service['status'] !== 'available') {
        echo json_encode(["success" => false, "message" => "This service is currently unavailable"]);
        $checkService->close();
        return;
    }
    
    $checkService->close();

    $orderId = 'ORD' . time() . rand(1000, 9999);
    $userId = $data['user_id'] ?? 0;
    $firstName = $data['firstName'];
    $lastName = $data['lastName'];
    $email = $data['email'];
    $phone = $data['phone'];
    $address = $data['address'];
    $serviceType = $data['serviceType'];
    $date = $data['date'];
    $timeSlot = $data['timeSlot'];
    $notes = $data['notes'] ?? '';
    
    $discountAmount = isset($data['discountAmount']) ? floatval($data['discountAmount']) : 0;
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

    $stmt = $conn->prepare("INSERT INTO orders (order_id, user_id, service_id, first_name, last_name, email, phone, address, service_type, date, time_slot, notes, discount_amount, senior_card_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("siisssssssssds", $orderId, $userId, $serviceId, $firstName, $lastName, $email, $phone, $address, $serviceType, $date, $timeSlot, $notes, $discountAmount, $seniorCardImage);

    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Order submitted successfully", "order_id" => $orderId]);
    } else {
        echo json_encode(["success" => false, "message" => "Order submission failed: " . $conn->error]);
    }
    
    $stmt->close();
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
?>