<?php
require_once "config.php";
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, PUT, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$input = json_decode(file_get_contents("php://input"), true);
if (!isset($input['content'])) {
    echo json_encode(["success" => false, "message" => "Content is required"]);
    exit;
}

$content = $input['content'];

$stmt = $conn->prepare("INSERT INTO settings (key_name, value) VALUES ('terms_and_conditions', ?) ON DUPLICATE KEY UPDATE value = ?");
$stmt->bind_param("ss", $content, $content);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Terms and Conditions updated successfully!"]);
} else {
    echo json_encode(["success" => false, "message" => "Database error: " . $stmt->error]);
}

$stmt->close();
$conn->close();
