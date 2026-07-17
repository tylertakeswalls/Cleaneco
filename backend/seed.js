require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Service = require('./models/Service');
const Order = require('./models/Order');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Add Services
    console.log('Seeding services...');
    let services = [];
    const newServices = [
      { name: 'Siphoning / Desludging', description: 'Complete siphoning of septic tanks.', base_price: 2500, status: 'available' },
      { name: 'Deep Cleaning', description: 'Comprehensive deep cleaning for residential and commercial spaces.', base_price: 5000, status: 'available' },
      { name: 'Declogging', description: 'Professional declogging of pipes and drainage systems.', base_price: 1500, status: 'available' },
      { name: 'Pest Control', description: 'Elimination of household and commercial pests.', base_price: 3000, status: 'available' },
      { name: 'Sanitization & Disinfection', description: 'Medical grade sanitization services.', base_price: 4500, status: 'available' }
    ];
    for (let s of newServices) {
      const exists = await Service.findOne({ name: s.name });
      if (!exists) {
        const created = await Service.create(s);
        services.push(created);
      } else {
        services.push(exists);
      }
    }

    // 2. Add Fake Users (Clients)
    console.log('Seeding users...');
    const hashedPass = await bcrypt.hash('password123', 10);
    const clients = [];
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Lisa'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    
    for (let i = 1; i <= 10; i++) {
      const email = `dummyclient${i}@example.com`;
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          username: `dummyclient${i}`,
          password: hashedPass,
          email: email,
          first_name: firstNames[Math.floor(Math.random() * firstNames.length)],
          last_name: lastNames[Math.floor(Math.random() * lastNames.length)],
          phone: `0917-000-${1000 + i}`,
          address: `${i * 10} Fake Street, Mock City, Metro Manila`,
          isVerified: true,
          role: 'client'
        });
      }
      clients.push(user);
    }

    // 3. Add Orders
    console.log('Seeding orders...');
    const statuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
    const timeSlots = ['Morning', 'Afternoon', 'Evening'];
    
    for (let i = 1; i <= 20; i++) {
      const randomService = services[Math.floor(Math.random() * services.length)];
      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const randomTimeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
      
      const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // Random date between 30 days ago and 30 days in the future
      const msPerDay = 24 * 60 * 60 * 1000;
      const offset = (Math.random() - 0.5) * 60 * msPerDay; 
      
      await Order.create({
        order_id: orderId,
        user_id: randomClient._id,
        service_id: randomService._id,
        first_name: randomClient.first_name,
        last_name: randomClient.last_name,
        email: randomClient.email,
        phone: randomClient.phone,
        address: randomClient.address,
        service_type: randomService.name,
        date: new Date(Date.now() + offset),
        time_slot: randomTimeSlot,
        status: randomStatus,
        price: randomService.base_price,
        tax_amount: randomService.base_price * 0.1,
      });
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding:', err);
    process.exit(1);
  }
}

seed();
