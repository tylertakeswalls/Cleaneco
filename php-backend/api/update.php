<?php
require_once "config.php";
require_once "email_helper.php";

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
    case 'notifications_read':
        markNotificationsRead($input, $conn);
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
    
    // Find the order_id for this row
    $findOrder = $conn->prepare("SELECT order_id FROM orders WHERE id = ?");
    $findOrder->bind_param("i", $id);
    $findOrder->execute();
    $orderResult = $findOrder->get_result();
    if ($orderResult->num_rows === 0) {
        echo json_encode(["success" => false, "message" => "Order item not found"]);
        $findOrder->close();
        return;
    }
    $orderRow = $orderResult->fetch_assoc();
    $orderId = $orderRow['order_id'];
    $findOrder->close();
    
    $success = true;
    $statusUpdated = false;

    // Begin transaction for safe updates
    $conn->begin_transaction();

    if ($status !== null) {
        $stmt = $conn->prepare("UPDATE orders SET status = ? WHERE order_id = ?");
        $stmt->bind_param("ss", $status, $orderId);
        if (!$stmt->execute()) {
            $success = false;
        }
        $stmt->close();
        $statusUpdated = true;
    }

    if ($price !== null && $success) {
        // Handle empty price string as null
        if ($price === '') {
            $stmt = $conn->prepare("UPDATE orders SET price = NULL WHERE id = ?");
            $stmt->bind_param("i", $id);
        } else {
            $stmt = $conn->prepare("UPDATE orders SET price = ? WHERE id = ?");
            $stmt->bind_param("di", $price, $id);
        }
        if (!$stmt->execute()) {
            $success = false;
        }
        $stmt->close();
    }

    if ($success) {
        $conn->commit();
        
        // If status was changed, send email confirmation to client
        if ($statusUpdated) {
            sendConfirmationEmail($orderId, $conn, true);
        }
        
        echo json_encode(["success" => true, "message" => "Order updated successfully"]);
    } else {
        $conn->rollback();
        echo json_encode(["success" => false, "message" => "Failed to update order"]);
    }
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

function markNotificationsRead($data, $conn) {
    $id = $data['id'] ?? null;
    if ($id !== null) {
        $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE id = ?");
        $stmt->bind_param("i", $id);
    } else {
        $stmt = $conn->prepare("UPDATE notifications SET is_read = 1");
    }
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Notifications marked as read"]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to update notifications"]);
    }
    $stmt->close();
}

$conn->close();
?>