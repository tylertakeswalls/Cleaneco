<?php
$conn = new mysqli('localhost', 'root', '', 'cleaneco_db');
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }
$result = $conn->query("SELECT username, date_of_birth FROM users ORDER BY created_at DESC LIMIT 5");
while($row = $result->fetch_assoc()) {
    echo "User: " . $row["username"] . " | DOB: " . $row["date_of_birth"] . "\n";
}
$conn->close();
?>
