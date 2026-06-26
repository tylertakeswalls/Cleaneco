<?php
include 'config.php';

$sql = "ALTER TABLE orders 
        ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0 AFTER price,
        ADD COLUMN senior_card_image VARCHAR(255) AFTER discount_amount";

if ($conn->query($sql) === TRUE) {
    echo "Table orders altered successfully\n";
} else {
    // If it fails, maybe columns already exist.
    echo "Error altering table (may already exist): " . $conn->error . "\n";
}

$conn->close();
?>
