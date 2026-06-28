<?php
require_once "config.php";
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$stmt = $conn->prepare("SELECT value FROM settings WHERE key_name = 'terms_and_conditions'");
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
    echo json_encode(["success" => true, "content" => $row['value']]);
} else {
    echo json_encode(["success" => true, "content" => "Terms and Conditions not found. Please update them in the admin dashboard."]);
}

$stmt->close();
$conn->close();
