const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

async function testEndpoint(method, path, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      headers: response.headers,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 'NO_RESPONSE',
      headers: error.response?.headers || {},
      data: error.response?.data || error.message
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Budget App Server\n');
  
  const tests = [
    { name: 'Root endpoint', method: 'GET', path: '/' },
    { name: 'Health check', method: 'GET', path: '/api/health' },
    { name: 'Spese endpoint (no auth)', method: 'GET', path: '/api/spese' },
    { name: 'Login endpoint (no body)', method: 'POST', path: '/api/auth/login' },
    { name: 'Login endpoint (with body)', method: 'POST', path: '/api/auth/login', data: { username: 'test', password: 'test' } },
    { name: 'Non-existent API endpoint', method: 'GET', path: '/api/nonexistent' },
    { name: 'Entrate endpoint', method: 'GET', path: '/api/entrate' },
    { name: 'Budget settings endpoint', method: 'GET', path: '/api/budget-settings' }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`${i + 1}. ${test.name}`);
    
    const result = await testEndpoint(test.method, test.path, test.data);
    
    console.log(`   Status: ${result.status}`);
    console.log(`   Content-Type: ${result.headers['content-type'] || 'NOT SET'}`);
    
    // Check if response is JSON
    const isJson = result.headers['content-type']?.includes('application/json');
    console.log(`   JSON Response: ${isJson ? '✅ YES' : '❌ NO'}`);
    
    // Check if response has content
    const hasContent = result.data && (typeof result.data === 'object' || result.data.length > 0);
    console.log(`   Has Content: ${hasContent ? '✅ YES' : '❌ NO'}`);
    
    if (typeof result.data === 'object') {
      console.log(`   Response: ${JSON.stringify(result.data).substring(0, 100)}...`);
    } else {
      console.log(`   Response: ${String(result.data).substring(0, 100)}...`);
    }
    
    // Test passes if it returns JSON (except for root endpoint)
    const shouldReturnJson = test.path.startsWith('/api');
    if (shouldReturnJson && isJson && hasContent) {
      console.log('   Result: ✅ PASS\n');
      passedTests++;
    } else if (!shouldReturnJson && hasContent) {
      console.log('   Result: ✅ PASS\n');
      passedTests++;
    } else {
      console.log('   Result: ❌ FAIL\n');
    }
  }
  
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Server is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the issues above.');
  }
  
  return passedTests === totalTests;
}

// Install axios if not present, then run tests
async function main() {
  try {
    require('axios');
  } catch (e) {
    console.log('📦 Installing axios for testing...');
    const { execSync } = require('child_process');
    execSync('npm install axios', { stdio: 'inherit' });
  }
  
  const success = await runTests();
  process.exit(success ? 0 : 1);
}

main();