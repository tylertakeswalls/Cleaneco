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

$input = json_decode(file_get_contents("php://input"), true);

if (!$input || !isset($input['username']) || !isset($input['password'])) {
    echo json_encode(["success" => false, "message" => "Username and password required"]);
    exit;
}

$username = $input['username'];
$password = $input['password'];

$stmt = $conn->prepare("SELECT id, username, password, email, first_name, last_name, phone, role, date_of_birth FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(["success" => false, "message" => "Invalid username or password"]);
    exit;
}

$user = $result->fetch_assoc();

if (password_verify($password, $user['password'])) {
    unset($user['password']); // Remove password from response
    
    // Generate a simple token
    $token = bin2hex(random_bytes(32));
    
    echo json_encode([
        "success" => true,
        "message" => "Login successful",
        "user" => $user,
        "token" => $token
    ]);
} else {
    echo json_encode(["success" => false, "message" => "Invalid username or password"]);
}

$stmt->close();
$conn->close();
?>