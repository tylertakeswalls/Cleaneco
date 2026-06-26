<?php
require_once "config.php";

// Add CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: DELETE, OPTIONS");
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
        deleteOrder($input, $conn);
        break;
    case 'service':
        deleteService($input, $conn);
        break;
    case 'user':
        deleteUser($input, $conn);
        break;
    default:
        echo json_encode(["success" => false, "message" => "Invalid delete type"]);
}

function deleteOrder($data, $conn) {
    if (!isset($data['id'])) {
        echo json_encode(["success" => false, "message" => "Order ID required"]);
        return;
    }
    
    $id = $data['id'];
    $stmt = $conn->prepare("DELETE FROM orders WHERE id = ?");
    $stmt->bind_param("i", $id);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Order deleted successfully"]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to delete order"]);
    }
    
    $stmt->close();
}

function deleteService($data, $conn) {
    if (!isset($data['id'])) {
        echo json_encode(["success" => false, "message" => "Service ID required"]);
        return;
    }
    
    $id = $data['id'];
    
    // Check if service has existing orders
    $checkStmt = $conn->prepare("SELECT COUNT(*) as order_count FROM orders WHERE service_id = ?");
    $checkStmt->bind_param("i", $id);
    $checkStmt->execute();
    $result = $checkStmt->get_result()->fetch_assoc();
    
    if ($result['order_count'] > 0) {
        echo json_encode(["success" => false, "message" => "Cannot delete service with existing orders"]);
        $checkStmt->close();
        return;
    }
    
    $checkStmt->close();
    $stmt = $conn->prepare("DELETE FROM services WHERE id = ?");
    $stmt->bind_param("i", $id);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Service deleted successfully"]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to delete service"]);
    }
    
    $stmt->close();
}

function deleteUser($data, $conn) {
    if (!isset($data['id'])) {
        echo json_encode(["success" => false, "message" => "User ID required"]);
        return;
    }
    
    $id = $data['id'];
    
    // Check if user has existing orders
    $checkStmt = $conn->prepare("SELECT COUNT(*) as order_count FROM orders WHERE user_id = ?");
    $checkStmt->bind_param("i", $id);
    $checkStmt->execute();
    $result = $checkStmt->get_result()->fetch_assoc();
    
    if ($result['order_count'] > 0) {
        echo json_encode(["success" => false, "message" => "Cannot delete user with existing orders"]);
        $checkStmt->close();
        return;
    }
    
    $checkStmt->close();
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ? AND role != 'admin'");
    $stmt->bind_param("i", $id);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "User deleted successfully"]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to delete user"]);
    }
    
    $stmt->close();
}

$conn->close();
?>