<?php
require_once "config.php";

// Add CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: PUT, OPTIONS");
header("Content-Type: application/json");

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$input = json_decode(file_get_contents("php://input"), true);

if (!$input || !isset($input['type'])) {
    echo json_encode(["success" => false, "message" => "Invalid or missing data"]);
    exit;
}

switch ($input['type']) {
    case 'order':
        updateOrder($input, $conn);
        break;
    case 'service':
        updateService($input, $conn);
        break;
    case 'user':
        updateUser($input, $conn);
        break;
    default:
        echo json_encode(["success" => false, "message" => "Invalid update type"]);
}

function updateOrder($data, $conn) {
    if (!isset($data['id'])) {
        echo json_encode(["success" => false, "message" => "Order ID required"]);
        return;
    }
    
    $id = $data['id'];
    $status = $data['status'] ?? null;
    $price = $data['price'] ?? null;
    
    $updates = [];
    $params = [];
    $types = "";
    
    if ($status !== null) {
        $updates[] = "status = ?";
        $params[] = $status;
        $types .= "s";
    }
    
    if ($price !== null) {
        $updates[] = "price = ?";
        $params[] = $price;
        $types .= "d";
    }
    
    if (empty($updates)) {
        echo json_encode(["success" => false, "message" => "No fields to update"]);
        return;
    }
    
    $params[] = $id;
    $types .= "i";
    
    $sql = "UPDATE orders SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Order updated successfully"]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to update order"]);
    }
    
    $stmt->close();
}

function updateService($data, $conn) {
    if (!isset($data['id'])) {
        echo json_encode(["success" => false, "message" => "Service ID required"]);
        return;
    }
    
    $id = $data['id'];
    $name = $data['name'] ?? null;
    $description = $data['description'] ?? null;
    $base_price = $data['base_price'] ?? null;
    $status = $data['status'] ?? null;
    
    $updates = [];
    $params = [];
    $types = "";
    
    if ($name !== null) {
        $updates[] = "name = ?";
        $params[] = $name;
        $types .= "s";
    }
    
    if ($description !== null) {
        $updates[] = "description = ?";
        $params[] = $description;
        $types .= "s";
    }
    
    if ($base_price !== null) {
        $updates[] = "base_price = ?";
        $params[] = $base_price;
        $types .= "d";
    }
    
    if ($status !== null) {
        $updates[] = "status = ?";
        $params[] = $status;
        $types .= "s";
    }
    
    if (empty($updates)) {
        echo json_encode(["success" => false, "message" => "No fields to update"]);
        return;
    }
    
    $params[] = $id;
    $types .= "i";
    
    $sql = "UPDATE services SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Service updated successfully"]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to update service"]);
    }
    
    $stmt->close();
}

function updateUser($data, $conn) {
    if (!isset($data['id'])) {
        echo json_encode(["success" => false, "message" => "User ID required"]);
        return;
    }
    
    $id = $data['id'];
    $firstName = $data['first_name'] ?? null;
    $lastName = $data['last_name'] ?? null;
    $email = $data['email'] ?? null;
    $phone = $data['phone'] ?? null;
    $address = $data['address'] ?? null;
    
    $updates = [];
    $params = [];
    $types = "";
    
    if ($firstName !== null) {
        $updates[] = "first_name = ?";
        $params[] = $firstName;
        $types .= "s";
    }
    
    if ($lastName !== null) {
        $updates[] = "last_name = ?";
        $params[] = $lastName;
        $types .= "s";
    }
    
    if ($email !== null) {
        $updates[] = "email = ?";
        $params[] = $email;
        $types .= "s";
    }
    
    if ($phone !== null) {
        $updates[] = "phone = ?";
        $params[] = $phone;
        $types .= "s";
    }
    
    if ($address !== null) {
        $updates[] = "address = ?";
        $params[] = $address;
        $types .= "s";
    }
    
    if (empty($updates)) {
        echo json_encode(["success" => false, "message" => "No fields to update"]);
        return;
    }
    
    $params[] = $id;
    $types .= "i";
    
    $sql = "UPDATE users SET " . implode(", ", $updates) . " WHERE id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "User updated successfully"]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to update user"]);
    }
    
    $stmt->close();
}

$conn->close();
?>