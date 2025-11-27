const axios = require('axios');

// Base URL for the API
const BASE_URL = 'http://localhost:5000';
const LOGIN_URL = `${BASE_URL}/auth/login`;

// Test login with different passwords
async function testLogin(email, password) {
  try {
    const response = await axios.post(LOGIN_URL, {
      userEmail: email,
      password: password
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Login successful for ${email} with password: ${password}`);
    console.log(`   Role: ${response.data.data.user.role}`);
    console.log(`   Status: ${response.data.data.user.status}`);
    return true;
  } catch (error) {
    console.log(`❌ Login failed for ${email} with password: ${password}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`   Network Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
    }
    return false;
  }
}

async function testAdminLogins() {
  console.log('Testing admin logins...\n');

  const adminEmail = 'admin@example.com';
  const passwordsToTest = [
    'Super@864!',
    'Super@321!',
    'Admin@123!',
    'admin123',
    'password'
  ];

  for (const password of passwordsToTest) {
    await testLogin(adminEmail, password);
    console.log('---');
  }

  // Also test the other admin
  console.log('\nTesting admin@gmail.com...\n');
  await testLogin('admin@gmail.com', 'admin123');
  await testLogin('admin@gmail.com', 'password');
}

testAdminLogins().catch(console.error);