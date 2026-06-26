<?php
require_once "config.php";

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        getServices();
        break;
    case 'POST':
        // Redirect to submit.php for adding services
        echo json_encode(["success" => false, "message" => "Use submit.php with type='service' to add services"]);
        break;
    case 'PUT':
        // Redirect to update.php for updating services
        echo json_encode(["success" => false, "message" => "Use update.php with type='service' to update services"]);
        break;
    case 'DELETE':
        echo json_encode(["success" => false, "message" => "Use delete.php with type='service' for deleting services"]);
        break;
    default:
        echo json_encode(["success" => false, "message" => "Method not allowed"]);
}

function getServices() {
    global $conn;
    
    $availableOnly = isset($_GET['available']) && $_GET['available'] == 'true';
    
    if ($availableOnly) {
        $stmt = $conn->prepare("SELECT * FROM services WHERE status = 'available' ORDER BY name");
    } else {
        $stmt = $conn->prepare("SELECT * FROM services ORDER BY name");
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $services = [];
    while ($row = $result->fetch_assoc()) {
        $services[] = $row;
    }
    
    echo json_encode($services);
    $stmt->close();
}

$conn->close();
?>