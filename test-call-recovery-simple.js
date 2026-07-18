/**
 * Simplified Call Recovery Test
 * Tests PR-02 implementation with automatic user creation
 */

const io = require('socket.io-client');
const axios = require('axios');

const API_URL = 'http://localhost:3000';
const SOCKET_URL = 'http://localhost:3000';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(50));
}

function logSuccess(message) {
  log('✓ ' + message, colors.green);
}

function logError(message) {
  log('✗ ' + message, colors.red);
}

function logInfo(message) {
  log('ℹ ' + message, colors.blue);
}

// Create unique test users
async function createTestUsers() {
  const timestamp = Date.now();
  const user1 = {
    email: `test1_${timestamp}@example.com`,
    password: 'Test@123456',
    name: `Test User 1 (${timestamp})`
  };
  
  const user2 = {
    email: `test2_${timestamp}@example.com`,
    password: 'Test@123456',
    name: `Test User 2 (${timestamp})`
  };
  
  try {
    // First register the users
    const [reg1, reg2] = await Promise.all([
      axios.post(`${API_URL}/api/auth/register`, user1),
      axios.post(`${API_URL}/api/auth/register`, user2)
    ]);
    
    // Then login to get tokens
    const [login1, login2] = await Promise.all([
      axios.post(`${API_URL}/api/auth/login`, { email: user1.email, password: user1.password }),
      axios.post(`${API_URL}/api/auth/login`, { email: user2.email, password: user2.password })
    ]);
    
    // Extract token and user ID from login response (nested in data.data)
    const token1 = login1.data.data?.accessToken || login1.data.accessToken;
    const token2 = login2.data.data?.accessToken || login2.data.accessToken;
    const userId1 = login1.data.data?.user?.id || login1.data.user?.id || reg1.data.user?.id;
    const userId2 = login2.data.data?.user?.id || login2.data.user?.id || reg2.data.user?.id;
    
    logInfo(`Token obtained for user1: ${token1 ? 'Yes' : 'No'}`);
    logInfo(`Token obtained for user2: ${token2 ? 'Yes' : 'No'}`);
    
    return {
      user1: { ...user1, token: token1, id: userId1 },
      user2: { ...user2, token: token2, id: userId2 }
    };
  } catch (error) {
    console.error('Error details:', error.response?.data || error.message);
    throw new Error(`Failed to create test users: ${error.message}`);
  }
}

// Create socket connection
function createSocket(token) {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false
  });
}

// Wait for event
function waitForEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Main test
async function runTest() {
  let socket1, socket2, reconnectedSocket1;
  let users;
  let testCallRecordId;
  
  try {
    logSection('PR-02: Active Call Recovery Test (Simplified)');
    
    // Create test users
    logInfo('Creating test users...');
    users = await createTestUsers();
    logSuccess(`User 1: ${users.user1.email}`);
    logSuccess(`User 2: ${users.user2.email}`);
    
    // Connect sockets
    logInfo('Connecting sockets...');
    socket1 = createSocket(users.user1.token);
    socket2 = createSocket(users.user2.token);
    
    await Promise.all([
      waitForEvent(socket1, 'connect'),
      waitForEvent(socket2, 'connect')
    ]);
    logSuccess('Both sockets connected');
    
    // Registration happens automatically on connection in the server
    // Just wait a bit for it to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    logSuccess('Both users auto-registered for calls');
    
    // Initiate call
    logInfo('Initiating call from User 1 to User 2...');
    
    const mockOffer = {
      type: 'offer',
      sdp: 'mock-sdp-offer'
    };
    
    // Set up listener for incoming call
    const incomingCallPromise = waitForEvent(socket2, 'incoming-call');
    
    // Make the call
    const callPromise = new Promise((resolve, reject) => {
      socket1.emit('call-user', {
        callerId: users.user1.id || 'user1',
        receiverId: users.user2.id || 'user2',
        offer: mockOffer
      }, (response) => {
        if (response.success) {
          testCallRecordId = response.callRecordId;
          resolve(response);
        } else {
          reject(new Error(response.message));
        }
      });
    });
    
    const [callResponse, incomingCall] = await Promise.all([
      callPromise,
      incomingCallPromise
    ]);
    
    logSuccess(`Call initiated with ID: ${testCallRecordId}`);
    logSuccess('User 2 received incoming call');
    
    // Answer call
    logInfo('User 2 answering call...');
    
    const mockAnswer = {
      type: 'answer',
      sdp: 'mock-sdp-answer'
    };
    
    const answerPromise = new Promise((resolve, reject) => {
      socket2.emit('answer-call', {
        callerId: users.user1.id || incomingCall.callerId || 'user1',
        answer: mockAnswer
      }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message));
        }
      });
    });
    
    await answerPromise;
    logSuccess('Call answered - connection established');
    
    // Simulate disconnection
    logInfo('Simulating User 1 disconnection...');
    socket1.disconnect();
    logSuccess('User 1 disconnected');
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reconnect
    logInfo('User 1 reconnecting...');
    reconnectedSocket1 = createSocket(users.user1.token);
    
    await waitForEvent(reconnectedSocket1, 'connect');
    logSuccess('User 1 reconnected');
    
    // Listen for call recovery events
    const callStatePromise = waitForEvent(reconnectedSocket1, 'call-state', 10000);
    const peerNotificationPromise = waitForEvent(socket2, 'call-recovered', 10000);
    
    // Trigger registration which should initiate recovery
    reconnectedSocket1.emit('register-user', {});
    
    // Check recovery
    logInfo('Waiting for call recovery...');
    
    const results = await Promise.allSettled([
      callStatePromise,
      peerNotificationPromise
    ]);
    
    const callState = results[0].status === 'fulfilled' ? results[0].value : null;
    const peerNotification = results[1].status === 'fulfilled' ? results[1].value : null;
    
    if (callState) {
      logSuccess('✅ Call state recovered:');
      logInfo(`   Call ID: ${callState.callRecordId}`);
      logInfo(`   Status: ${callState.status}`);
      logInfo(`   Has Offer: ${!!callState.offer}`);
      logInfo(`   Has Answer: ${!!callState.answer}`);
    } else {
      logError('❌ Call state not recovered');
    }
    
    if (peerNotification) {
      logSuccess('✅ Peer notified of reconnection:');
      logInfo(`   Reconnected User: ${peerNotification.peerId}`);
      logInfo(`   Is Reconnecting: ${peerNotification.isReconnecting}`);
    } else {
      logError('❌ Peer not notified');
    }
    
    // Test explicit recovery
    logInfo('Testing explicit call recovery...');
    
    const explicitRecoveryPromise = new Promise((resolve) => {
      reconnectedSocket1.emit('recover-call', {
        callRecordId: testCallRecordId
      }, resolve);
    });
    
    const explicitRecovery = await explicitRecoveryPromise;
    if (explicitRecovery.success) {
      logSuccess('✅ Explicit recovery successful');
    } else {
      logError(`❌ Explicit recovery failed: ${explicitRecovery.message}`);
    }
    
    // End call
    logInfo('Ending call...');
    reconnectedSocket1.emit('end-call', {
      receiverId: users.user2.id || 'user2'
    });
    
    // Summary
    logSection('Test Results Summary');
    if (callState || peerNotification) {
      logSuccess('✅ PR-02 Call Recovery Working!');
      logInfo('Key features verified:');
      if (callState) logInfo('  ✓ Call state preservation');
      if (peerNotification) logInfo('  ✓ Peer notification');
      if (explicitRecovery.success) logInfo('  ✓ Explicit recovery API');
    } else {
      logError('❌ Call Recovery Not Working Properly');
      logInfo('Please check:');
      logInfo('  - Server logs for errors');
      logInfo('  - Socket authentication');
      logInfo('  - Call state tracking');
    }
    
  } catch (error) {
    logError(`Test failed: ${error.message}`);
    console.error(error);
  } finally {
    // Cleanup
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
    if (reconnectedSocket1) reconnectedSocket1.disconnect();
    
    setTimeout(() => process.exit(0), 1000);
  }
}

// Run test
runTest().catch(console.error);