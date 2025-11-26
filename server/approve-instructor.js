const axios = require('axios');

// Base URL for the API
const BASE_URL = 'http://localhost:5002';
const LOGIN_URL = `${BASE_URL}/auth/login`;
const PENDING_INSTRUCTORS_URL = `${BASE_URL}/admin/instructors/pending`;
const APPROVE_INSTRUCTOR_URL = (id) => `${BASE_URL}/admin/instructors/${id}/approve`;

// Function to login as admin
async function loginAsAdmin() {
  try {
    const response = await axios.post(LOGIN_URL, {
      userEmail: 'admin@example.com',
      password: 'Super@864!'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Successfully logged in as admin');
    return response.data.data.accessToken;
  } catch (error) {
    console.error('❌ Failed to login as admin');
    if (error.response) {
      console.error(`   Error: ${error.response.data.message}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    return null;
  }
}

// Function to get pending instructors
async function getPendingInstructors(adminToken) {
  try {
    const response = await axios.get(PENDING_INSTRUCTORS_URL, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    return response.data.data || [];
  } catch (error) {
    console.error('❌ Failed to get pending instructors');
    if (error.response) {
      console.error(`   Error: ${error.response.data.message}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    return [];
  }
}

// Function to approve instructor
async function approveInstructor(adminToken, instructorId) {
  try {
    const response = await axios.patch(APPROVE_INSTRUCTOR_URL(instructorId), {}, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });

    console.log('✅ Successfully approved instructor');
    return true;
  } catch (error) {
    console.error('❌ Failed to approve instructor');
    if (error.response) {
      console.error(`   Error: ${error.response.data.message}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    return false;
  }
}

// Main function
async function approveInstructorMain() {
  console.log('🔄 Approving instructor account...\n');

  const adminToken = await loginAsAdmin();
  if (!adminToken) {
    console.log('❌ Cannot proceed without admin token');
    return;
  }

  const pendingInstructors = await getPendingInstructors(adminToken);
  console.log(`Found ${pendingInstructors.length} pending instructors`);

  const instructorToApprove = pendingInstructors.find(inst => inst.userEmail === 'instructor@example.com');

  if (instructorToApprove) {
    console.log(`Approving instructor: ${instructorToApprove.userEmail}`);
    await approveInstructor(adminToken, instructorToApprove._id);
  } else {
    console.log('⚠️ Instructor not found in pending list or already approved');
  }

  console.log('🎉 Instructor approval process completed!');
}

// Run the script
approveInstructorMain().catch(console.error);