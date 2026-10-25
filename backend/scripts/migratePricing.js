require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Service = require('../models/Service');
const Order = require('../models/Order');

async function runMigration() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI not found in environment');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  // 1. Migrate Services
  const services = await Service.find();
  console.log(`Found ${services.length} services to inspect.`);

  const serviceMap = {};

  for (const s of services) {
    const sName = (s.name || '').toLowerCase();
    let updated = false;

    if (sName.includes('siphon') || sName.includes('desludg')) {
      s.pricing_mode = 'calculated';
      s.rate = 8000;
      s.fixed_fee = 0;
      s.base_price = 8000;
      s.fields = [
        {
          key: 'numTanks',
          label: 'Number of Septic Tanks',
          type: 'number',
          min: 1,
          default: 1,
          counts_toward_trips: true,
          options: []
        },
        {
          key: 'capacityType',
          label: 'Estimated Tank Capacity / Type',
          type: 'multiplier',
          min: 1,
          default: '1',
          counts_toward_trips: true,
          options: [
            {
              value: '1',
              label: 'Standard Residential (1 Trip / ~10 cu.m)',
              factor: 1,
              amount: 0,
              requires_photo: false
            },
            {
              value: '2',
              label: 'Large Commercial / Multi-tank (2+ Trips)',
              factor: 2,
              amount: 0,
              requires_photo: false
            }
          ]
        },
        {
          key: 'accessibility',
          label: 'Site Accessibility',
          type: 'surcharge',
          min: 1,
          default: 'easy',
          counts_toward_trips: false,
          options: [
            {
              value: 'easy',
              label: 'Easy (Truck can park within 10–20 meters)',
              factor: 1,
              amount: 0,
              requires_photo: false
            },
            {
              value: 'difficult',
              label: 'Difficult / Deep (Needs long extension hoses or narrow alley access)',
              factor: 1,
              amount: 1500,
              requires_photo: true
            }
          ]
        }
      ];
      updated = true;
    } else if (sName.includes('deep clean') || sName.includes('declog')) {
      s.pricing_mode = 'calculated';
      s.rate = 8000;
      s.fixed_fee = 0;
      s.base_price = 8000;
      s.fields = [
        {
          key: 'numTanks',
          label: 'Number of Septic Tanks',
          type: 'number',
          min: 1,
          default: 1,
          counts_toward_trips: true,
          options: []
        }
      ];
      updated = true;
    } else {
      if (!s.pricing_mode) {
        s.pricing_mode = 'calculated';
        s.rate = s.base_price || 0;
        s.fixed_fee = 0;
        s.fields = s.fields || [];
        updated = true;
      }
    }

    if (updated) {
      await s.save();
      console.log(`Updated pricing structure for service: "${s.name}" (${s._id})`);
    }

    serviceMap[String(s._id)] = {
      id: String(s._id),
      name: s.name,
      description: s.description,
      pricing_mode: s.pricing_mode,
      rate: s.rate,
      fixed_fee: s.fixed_fee,
      base_price: s.base_price,
      fields: s.fields.map(f => ({
        key: f.key,
        label: f.label,
        type: f.type,
        min: f.min,
        default: f.default,
        counts_toward_trips: f.counts_toward_trips,
        options: (f.options || []).map(o => ({
          value: o.value,
          label: o.label,
          factor: o.factor,
          amount: o.amount,
          requires_photo: o.requires_photo
        }))
      }))
    };
  }

  // 2. Migrate existing Orders with pricing snapshots
  const ordersToUpdate = await Order.find({
    $or: [
      { pricing_snapshot: { $exists: false } },
      { pricing_snapshot: null },
      { pricing_snapshot: {} }
    ]
  });

  console.log(`Found ${ordersToUpdate.length} orders lacking pricing_snapshot.`);

  let updatedOrdersCount = 0;
  for (const order of ordersToUpdate) {
    const snapshot = {};
    
    // Check order.service_id
    if (order.service_id && serviceMap[String(order.service_id)]) {
      snapshot[String(order.service_id)] = serviceMap[String(order.service_id)];
    }

    // Also check keys in estimate_inputs
    if (order.estimate_inputs && typeof order.estimate_inputs === 'object') {
      Object.keys(order.estimate_inputs).forEach(sId => {
        if (serviceMap[sId]) {
          snapshot[sId] = serviceMap[sId];
        }
      });
    }

    // If still empty, match by service_type name
    if (Object.keys(snapshot).length === 0 && order.service_type) {
      const match = Object.values(serviceMap).find(s => 
        (s.name || '').toLowerCase() === (order.service_type || '').toLowerCase()
      );
      if (match) {
        snapshot[match.id] = match;
      }
    }

    if (Object.keys(snapshot).length > 0) {
      await Order.updateOne({ _id: order._id }, { $set: { pricing_snapshot: snapshot } });
      updatedOrdersCount++;
    }
  }

  console.log(`Successfully migrated ${updatedOrdersCount} orders with pricing snapshots.`);
  console.log('Migration complete!');
  await mongoose.disconnect();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
