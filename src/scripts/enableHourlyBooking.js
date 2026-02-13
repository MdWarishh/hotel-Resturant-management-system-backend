// backend/src/scripts/enableHourlyBooking.js
// Run this script once to update all existing rooms

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// Update all rooms to support hourly booking
const enableHourlyBookingForAllRooms = async () => {
  try {
    console.log('🔄 Starting to update rooms...\n');

    // Get all rooms
    const Room = mongoose.model('Room');
    const rooms = await Room.find({});

    console.log(`📊 Found ${rooms.length} rooms to update\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const room of rooms) {
      // Calculate hourly rate as 40% of base price if not set
      const hourlyRate = room.pricing.hourlyRate > 0 
        ? room.pricing.hourlyRate 
        : Math.ceil(room.pricing.basePrice * 0.4);

      const wasAlreadyEnabled = room.features.allowHourlyBooking && room.pricing.hourlyRate > 0;

      // Update room
      room.pricing.hourlyRate = hourlyRate;
      room.features.allowHourlyBooking = true;
      
      await room.save();

      if (wasAlreadyEnabled) {
        skippedCount++;
        console.log(`⏭️  ${room.roomNumber} - Already enabled, skipped`);
      } else {
        updatedCount++;
        console.log(`✅ ${room.roomNumber} - Enabled (₹${hourlyRate}/hour)`);
      }
    }

    console.log(`\n📈 Update Summary:`);
    console.log(`   ✅ Updated: ${updatedCount} rooms`);
    console.log(`   ⏭️  Skipped: ${skippedCount} rooms (already enabled)`);
    console.log(`   📊 Total: ${rooms.length} rooms\n`);

    console.log('✨ All rooms now support hourly booking!\n');

  } catch (error) {
    console.error('❌ Error updating rooms:', error.message);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await enableHourlyBookingForAllRooms();
    
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
};

// Run the script
main();