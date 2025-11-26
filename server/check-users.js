const mongoose = require('mongoose');
require('dotenv').config();

// User model
const User = require('./models/User');

async function checkUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to MongoDB');

    // Find all users
    const users = await User.find({}, 'userName userEmail role status').lean();

    console.log('\n📋 Existing Users:');
    console.log('==================');

    users.forEach(user => {
      console.log(`Role: ${user.role}`);
      console.log(`Email: ${user.userEmail}`);
      console.log(`Username: ${user.userName}`);
      console.log(`Status: ${user.status}`);
      console.log('---');
    });

    // Approve all pending instructors
    const pendingInstructors = users.filter(user => user.role === 'instructor' && user.status === 'pending');
    if (pendingInstructors.length > 0) {
      console.log(`\n🔄 Approving ${pendingInstructors.length} pending instructors...`);
      for (const instructor of pendingInstructors) {
        await User.findByIdAndUpdate(instructor._id, { status: 'approved' });
        console.log(`✅ Approved instructor: ${instructor.userEmail}`);
      }
    } else {
      console.log('\n⚠️ No pending instructors found to approve');
    }

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUsers();