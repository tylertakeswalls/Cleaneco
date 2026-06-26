<?php
$conn = new mysqli('localhost', 'root', '', 'cleaneco_db');
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }
$result = $conn->query("SELECT email, date_of_birth FROM users WHERE email = 'oldie@gmail.com'");
while($row = $result->fetch_assoc()) {
    print_r($row);
}
$conn->close();
?>
