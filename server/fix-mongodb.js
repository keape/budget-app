const mongoose = require('mongoose');
require('dotenv').config();

console.log('🔧 MongoDB Connection Troubleshooting\n');

// Test different connection strings
const testConnections = [
  // Current connection string
  process.env.MONGODB_URI,
  // Alternative without appName
  process.env.MONGODB_URI?.replace('&appName=budgetapp', ''),
  // With different retry settings
  process.env.MONGODB_URI?.replace('retryWrites=true&w=majority', 'retryWrites=false')
];

async function testConnection(uri, label) {
  if (!uri) {
    console.log(`❌ ${label}: URI is empty or undefined`);
    return false;
  }
  
  console.log(`🔍 Testing ${label}...`);
  console.log(`URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  
  try {
    await mongoose.connect(uri, { 
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log(`✅ ${label}: Connection successful!`);
    
    // Test basic operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📂 Collections found: ${collections.length}`);
    
    await mongoose.disconnect();
    return true;
    
  } catch (error) {
    console.log(`❌ ${label}: ${error.message}`);
    
    if (error.message.includes('bad auth')) {
      console.log('   💡 Authentication failed - check username/password');
    } else if (error.message.includes('ENOTFOUND')) {
      console.log('   💡 DNS resolution failed - check cluster URL');
    } else if (error.message.includes('timeout')) {
      console.log('   💡 Connection timeout - check network/firewall');
    }
    
    return false;
  }
}

async function main() {
  console.log('Environment variables:');
  console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? 'SET' : 'NOT SET'}`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
  console.log(`PORT: ${process.env.PORT || 'NOT SET'}\n`);
  
  let success = false;
  for (let i = 0; i < testConnections.length; i++) {
    const result = await testConnection(testConnections[i], `Test ${i + 1}`);
    if (result) {
      success = true;
      break;
    }
    console.log('');
  }
  
  if (!success) {
    console.log('\n🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Check MongoDB Atlas dashboard - is cluster running?');
    console.log('2. Verify network access settings - is your IP whitelisted?');
    console.log('3. Check database user permissions - can user read/write?');
    console.log('4. Try regenerating the database user password');
    console.log('5. Ensure the database name matches your cluster setup');
    console.log('\n📝 To fix authentication issues:');
    console.log('   - Go to MongoDB Atlas Dashboard');
    console.log('   - Database Access → Edit User → Reset Password');
    console.log('   - Update the MONGODB_URI in your .env file');
  }
  
  process.exit(success ? 0 : 1);
}

main();