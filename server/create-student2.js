const axios = require('axios');

// Base URL for the API
const BASE_URL = 'http://localhost:5000/auth/register';

// New student user data
const newStudent = {
  userName: 'student_user2',
  userEmail: 'student2@example.com',
  password: 'Learn@8c4!',
  role: 'student'
};

// Function to register the student
async function registerStudent(userData) {
  try {
    const response = await axios.post(BASE_URL, userData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Successfully registered student: ${userData.userEmail}`);
    console.log(`   Username: ${userData.userName}`);
    console.log(`   Password: ${userData.password}`);
    console.log(`   Status: ${response.data.message}`);
    console.log('---');
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ Failed to register student: ${userData.userEmail}`);
    if (error.response) {
      console.error(`   Error: ${error.response.data.message}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    console.log('---');
    return { success: false, error };
  }
}

// Main function
async function createStudent() {
  console.log('🚀 Creating additional student user...\n');

  const result = await registerStudent(newStudent);

  if (result.success) {
    console.log('🎉 Student user created successfully!');
    console.log('\n📋 New Student Credentials:');
    console.log('===========================');
    console.log(`Email: ${newStudent.userEmail}`);
    console.log(`Password: ${newStudent.password}`);
    console.log(`Role: ${newStudent.role}`);
  } else {
    console.log('❌ Failed to create student user');
  }
}

// Run the script
createStudent().catch(console.error);