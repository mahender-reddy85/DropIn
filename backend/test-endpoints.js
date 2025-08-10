const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Test configuration
const BASE_URL = 'http://localhost:3001';
const TEST_USER = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpassword123'
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(testName, passed, error = null) {
  const result = { testName, passed, error };
  results.tests.push(result);
  if (passed) {
    results.passed++;
    console.log(`✅ ${testName}`);
  } else {
    results.failed++;
    console.log(`❌ ${testName}: ${error}`);
  }
}

async function testUserRegistration() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, TEST_USER);
    logTest('User Registration', response.status === 201);
    return response.data;
  } catch (error) {
    logTest('User Registration', false, error.response?.data?.error || error.message);
    return null;
  }
}

async function testUserLogin() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    logTest('User Login', response.status === 200 && response.data.token);
    return response.data.token;
  } catch (error) {
    logTest('User Login', false, error.response?.data?.error || error.message);
    return null;
  }
}

async function testInvalidLogin() {
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: 'invalid@example.com',
      password: 'wrongpassword'
    });
    logTest('Invalid Login', false, 'Should have failed');
  } catch (error) {
    logTest('Invalid Login', error.response?.status === 401);
  }
}

async function testFileUpload(token) {
  try {
    const form = new FormData();
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for upload testing');
    
    form.append('files', fs.createReadStream(testFilePath));
    
    const response = await axios.post(`${BASE_URL}/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });
    
    logTest('File Upload', response.status === 201 && response.data.files.length > 0);
    
    // Cleanup
    fs.unlinkSync(testFilePath);
    return response.data.files[0];
  } catch (error) {
    logTest('File Upload', false, error.response?.data?.error || error.message);
    return null;
  }
}

async function testFileDownload(fileId) {
  try {
    const response = await axios.get(`${BASE_URL}/download/${fileId}`, {
      responseType: 'stream'
    });
    logTest('File Download', response.status === 200);
    return true;
  } catch (error) {
    logTest('File Download', false, error.response?.data?.error || error.message);
    return false;
  }
}

async function testInvalidFileUpload() {
  try {
    const form = new FormData();
    const testFilePath = path.join(__dirname, 'test-large-file.txt');
    const largeContent = 'x'.repeat(101 * 1024 * 1024); // 101MB
    fs.writeFileSync(testFilePath, largeContent);
    
    form.append('files', fs.createReadStream(testFilePath));
    
    await axios.post(`${BASE_URL}/upload`, form, {
      headers: form.getHeaders()
    });
    
    logTest('Invalid File Upload (oversized)', false, 'Should have failed');
  } catch (error) {
    logTest('Invalid File Upload (oversized)', error.response?.status === 400 || error.response?.status === 413);
  } finally {
    if (fs.existsSync(path.join(__dirname, 'test-large-file.txt'))) {
      fs.unlinkSync(path.join(__dirname, 'test-large-file.txt'));
    }
  }
}

async function runTests() {
  console.log('🧪 Starting backend endpoint tests...\n');
  
  // Test user registration
  await testUserRegistration();
  
  // Test user login
  const token = await testUserLogin();
  
  // Test invalid login
  await testInvalidLogin();
  
  // Test file upload (if login successful)
  let uploadedFile = null;
  if (token) {
    uploadedFile = await testFileUpload(token);
  }
  
  // Test file download (if upload successful)
  if (uploadedFile) {
    await testFileDownload(uploadedFile.id);
  }
  
  // Test invalid file upload
  await testInvalidFileUpload();
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);
  
  if (results.failed > 0) {
    console.log('\n🔍 Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.testName}: ${t.error}`);
    });
  }
}

// Run tests when server is ready
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
