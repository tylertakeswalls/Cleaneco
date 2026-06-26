CREATE DATABASE cleaneco_db;
USE cleaneco_db;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    gender VARCHAR(20),
    date_of_birth DATE,
    role ENUM('admin', 'client') DEFAULT 'client',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert admin user with password "admin123"
INSERT INTO users (username, password, email, first_name, last_name, role) 
VALUES ('admin', '$2y$10$1C6n/O7Q56c8JTbQo3aNg.E9nrpw4V6EYFqnrLJipiD/alL43w0PG', 'admin@cleaneco.com', 'Admin', 'User', 'admin');

-- Add test client with password "client123"

INSERT INTO users (username, password, email, first_name, last_name, phone, address, gender, role) 
VALUES ('client1', '$2y$10$VnxZdiE0MM8Dcvg7bQNF2eDD2dZGbCOe0q.sDhjWme4Cr6jRrvPDC', 'client@test.com', 'John', 'Doe', '09123456789', 'Test Address', 'male', 'client');

-- Services table
CREATE TABLE services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2),
    status ENUM('available', 'unavailable') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default services
INSERT INTO services (name, description, base_price, status) VALUES
('Declogging', 'Clearing of blockages in pipes and drainage systems', 1500.00, 'available'),
('Siphoning/Desludging', 'Removal of accumulated sludge from septic tanks', 2500.00, 'available'),
('Deep Cleaning', 'Thorough cleaning of septic tanks and grease traps', 3500.00, 'available'),
('Grease Trap Cleaning', 'Specialized cleaning for food establishments', 2000.00, 'available');

-- Orders table
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    service_id INT NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    time_slot ENUM('Morning', 'Afternoon', 'Evening') NOT NULL,
    status ENUM('Pending', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Pending',
    price DECIMAL(10, 2),
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    senior_card_image VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
);