const axios = require('axios');

// Base URL for the API
const BASE_URL = 'http://localhost:5000';
const REGISTER_URL = `${BASE_URL}/auth/register`;
const LOGIN_URL = `${BASE_URL}/auth/login`;
const APPROVE_INSTRUCTOR_URL = (id) => `${BASE_URL}/admin/instructors/${id}/approve`;
const PENDING_INSTRUCTORS_URL = `${BASE_URL}/admin/instructors/pending`;

// User data - 3 Students, 3 Instructors, 3 Admins
const users = [
  // Students
  {
    userName: 'student_user1',
    userEmail: 'student1@example.com',
    password: 'Learn@246!',
    role: 'student'
  },
  {
    userName: 'student_user2',
    userEmail: 'student2@example.com',
    password: 'Study@8c4!',
    role: 'student'
  },
  {
    userName: 'student_user3',
    userEmail: 'student3@example.com',
    password: 'Read@9f2!',
    role: 'student'
  },
  // Instructors
  {
    userName: 'instructor_user1',
    userEmail: 'instructor1@example.com',
    password: 'Teach@975!',
    role: 'instructor'
  },
  {
    userName: 'instructor_user2',
    userEmail: 'instructor2@example.com',
    password: 'Guide@7h3!',
    role: 'instructor'
  },
  {
    userName: 'instructor_user3',
    userEmail: 'instructor3@example.com',
    password: 'Coach@4k8!',
    role: 'instructor'
  },
  // Admins
  {
    userName: 'admin_user1',
    userEmail: 'admin1@example.com',
    password: 'Super@321!',
    role: 'admin'
  },
  {
    userName: 'admin_user2',
    userEmail: 'admin2@example.com',
    password: 'Master@5p9!',
    role: 'admin'
  },
  {
    userName: 'admin_user3',
    userEmail: 'admin3@example.com',
    password: 'Chief@2w7!',
    role: 'admin'
  }
];

// Function to register a user
async function registerUser(userData) {
  try {
    const response = await axios.post(REGISTER_URL, userData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Successfully registered ${userData.role}: ${userData.userEmail}`);
    console.log(`   Username: ${userData.userName}`);
    console.log(`   Password: ${userData.password}`);
    console.log(`   Status: ${response.data.message}`);
    console.log('---');
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ Failed to register ${userData.role}: ${userData.userEmail}`);
    if (error.response) {
      console.error(`   Error: ${error.response.data.message}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    console.log('---');
    return { success: false, error };
  }
}

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
async function createUsers() {
  console.log('🚀 Starting user registration...\n');

  let instructorRegistered = false;

  for (const user of users) {
    const result = await registerUser(user);
    if (user.role === 'instructor' && result.success) {
      instructorRegistered = true;
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // If instructors were registered, approve them
  if (instructorRegistered) {
    console.log('\n🔄 Approving instructor accounts...\n');

    const adminToken = await loginAsAdmin();
    if (adminToken) {
      const pendingInstructors = await getPendingInstructors(adminToken);
      console.log(`Found ${pendingInstructors.length} pending instructors`);

      for (const instructor of pendingInstructors) {
        console.log(`Approving instructor: ${instructor.userEmail}`);
        await approveInstructor(adminToken, instructor._id);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  console.log('🎉 User registration and approval completed!');
  console.log('\n📋 User Credentials:');
  console.log('===================');

  // Group users by role for better display
  const students = users.filter(u => u.role === 'student');
  const instructors = users.filter(u => u.role === 'instructor');
  const admins = users.filter(u => u.role === 'admin');

  console.log('STUDENTS:');
  students.forEach((user, index) => {
    console.log(`  ${index + 1}. Email: ${user.userEmail}`);
    console.log(`     Password: ${user.password}`);
  });

  console.log('\nINSTRUCTORS:');
  instructors.forEach((user, index) => {
    console.log(`  ${index + 1}. Email: ${user.userEmail}`);
    console.log(`     Password: ${user.password}`);
  });

  console.log('\nADMINS:');
  admins.forEach((user, index) => {
    console.log(`  ${index + 1}. Email: ${user.userEmail}`);
    console.log(`     Password: ${user.password}`);
  });
}

// Run the script
createUsers().catch(console.error);