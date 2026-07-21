require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB for Seeding');
    
    const today = new Date();
    const ordersToInject = [];
    
    // We will generate data for the past 12 months.
    // To simulate growth, the number of orders will increase slightly each month,
    // and the price per order might vary a bit.
    
    for (let i = 11; i >= 0; i--) {
        // monthDate will be roughly the 15th of that past month
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 15);
        
        // Simulate growth: Start with ~5 orders 12 months ago, grow to ~25+ orders now.
        const baseOrders = 5 + ((11 - i) * 2);
        const randomFactor = Math.floor(Math.random() * 4); // 0 to 3 extra orders
        const numOrders = baseOrders + randomFactor;
        
        for (let j = 0; j < numOrders; j++) {
            ordersToInject.push({
                order_id: 'SEED-' + monthDate.getTime() + '-' + j,
                first_name: 'John',
                last_name: 'Doe',
                email: 'seed@cwms.com.ph',
                phone: '09123456789',
                address: 'Seeded Address, Bacoor City',
                service_type: 'General Cleaning',
                date: new Date(monthDate.getTime() + (j * 86400000)), // spread them out a bit
                time_slot: j % 2 === 0 ? 'Morning' : 'Afternoon',
                status: 'Completed',
                price: Math.floor(1500 + Math.random() * 1000), // Random price between 1500 and 2500
                tax_amount: 150,
                discount_amount: 0,
                notes: 'Seeded for dashboard statistics'
            });
        }
    }
    
    await Order.insertMany(ordersToInject);
    console.log(`Successfully injected ${ordersToInject.length} completed orders spanning the last 12 months.`);
    
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
