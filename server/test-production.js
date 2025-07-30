const axios = require('axios');

// Sostituisci con il tuo URL Render effettivo
const BASE_URL = 'https://budget-app-backend.onrender.com';

async function testEndpoints() {
  console.log('🧪 Testing Budget App Backend on Render...\n');

  // Test 1: Server Health
  try {
    const response = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health Check:', response.data);
  } catch (error) {
    console.error('❌ Health Check failed:', error.message);
  }

  // Test 2: Root endpoint
  try {
    const response = await axios.get(`${BASE_URL}/`);
    console.log('✅ Root endpoint:', response.data);
  } catch (error) {
    console.error('❌ Root endpoint failed:', error.message);
  }

  // Test 3: CORS preflight
  try {
    const response = await axios.options(`${BASE_URL}/api/auth/login`, {
      headers: {
        'Origin': 'https://budget-app-three-gules.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log('✅ CORS Preflight successful');
  } catch (error) {
    console.error('❌ CORS Preflight failed:', error.message);
  }

  // Test 4: API endpoint without auth (should return 503 if DB disconnected)
  try {
    const response = await axios.get(`${BASE_URL}/api/spese`);
    console.log('✅ API endpoint (spese):', response.data);
  } catch (error) {
    if (error.response?.status === 503) {
      console.log('⚠️ API endpoint (spese): Database not connected (expected)');
    } else {
      console.error('❌ API endpoint (spese) failed:', error.message);
    }
  }

  console.log('\n🏁 Test completed!');
}

testEndpoints();