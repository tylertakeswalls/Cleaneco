<?php
require_once "config.php";

$type = $_GET['type'] ?? '';
$id = $_GET['id'] ?? 0;

switch ($type) {
    case 'users':
        readUsers($conn);
        break;
    case 'orders':
        readOrders($conn, $id);
        break;
    case 'services':
        readServices($conn);
        break;
    case 'user_orders':
        readUserOrders($conn, $id);
        break;
    case 'user':
        readUser($conn, $id);
        break;
    case 'availability':
        readAvailability($conn);
        break;
    case 'notifications':
        readNotifications($conn);
        break;
    default:
        echo json_encode(["message" => "Invalid read type"]);
}

function readUsers($conn) {
    $sql = "SELECT id, username, email, first_name, last_name, phone, role, created_at FROM users WHERE role = 'client'";
    $result = $conn->query($sql);
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    
    echo json_encode($users);
}

function readUser($conn, $userId) {
    $stmt = $conn->prepare("SELECT id, username, email, first_name, last_name, phone, address, gender, date_of_birth FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();
        echo json_encode($user);
    } else {
        echo json_encode(null);
    }
    
    $stmt->close();
}

function readOrders($conn, $userId = 0) {
    if ($userId > 0) {
        // Get specific user's orders
        $stmt = $conn->prepare("
            SELECT o.*, s.name as service_name, s.status as service_status 
            FROM orders o 
            LEFT JOIN services s ON o.service_id = s.id 
            WHERE o.user_id = ? 
            ORDER BY o.created_at DESC
        ");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        // Get all orders (for admin)
        $sql = "
            SELECT o.*, u.username, s.name as service_name 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            LEFT JOIN services s ON o.service_id = s.id 
            ORDER BY o.created_at DESC
        ";
        $result = $conn->query($sql);
    }
    
    $orders = [];
    while ($row = $result->fetch_assoc()) {
        $orders[] = $row;
    }
    
    echo json_encode($orders);
}

function readServices($conn) {
    $availableOnly = isset($_GET['available']) && $_GET['available'] == 'true';
    
    if ($availableOnly) {
        $sql = "SELECT * FROM services WHERE status = 'available' ORDER BY name";
    } else {
        $sql = "SELECT * FROM services ORDER BY name";
    }
    
    $result = $conn->query($sql);
    
    $services = [];
    while ($row = $result->fetch_assoc()) {
        $services[] = $row;
    }
    
    echo json_encode($services);
}

function readUserOrders($conn, $userId) {
    $stmt = $conn->prepare("
        SELECT o.*, s.name as service_name 
        FROM orders o 
        LEFT JOIN services s ON o.service_id = s.id 
        WHERE o.user_id = ? 
        ORDER BY o.created_at DESC
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $orders = [];
    while ($row = $result->fetch_assoc()) {
        $orders[] = $row;
    }
    
    echo json_encode($orders);
}

function readAvailability($conn) {
    $sql = "SELECT date, time_slot, COUNT(DISTINCT order_id) as booking_count 
            FROM orders 
            GROUP BY date, time_slot";
    $result = $conn->query($sql);
    $availability = [];
    while ($row = $result->fetch_assoc()) {
        $availability[] = [
            'date' => $row['date'],
            'time_slot' => $row['time_slot'],
            'booking_count' => intval($row['booking_count'])
        ];
    }
    echo json_encode($availability);
}

function readNotifications($conn) {
    $result = $conn->query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50");
    $notifications = [];
    while ($row = $result->fetch_assoc()) {
        $notifications[] = [
            'id' => intval($row['id']),
            'order_id' => $row['order_id'],
            'message' => $row['message'],
            'details' => $row['details'],
            'is_read' => intval($row['is_read']),
            'created_at' => $row['created_at']
        ];
    }
    echo json_encode($notifications);
}

$conn->close();
?>