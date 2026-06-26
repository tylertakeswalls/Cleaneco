<?php
$conn = new mysqli('localhost', 'root', '', 'cleaneco_db');
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }
$result = $conn->query("SELECT order_id, service_type, discount_amount, senior_card_image FROM orders ORDER BY created_at DESC LIMIT 1");
$row = $result->fetch_assoc();
print_r($row);
$conn->close();
?>
