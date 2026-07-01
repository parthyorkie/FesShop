/**
 * Test Client for Real-time Presence System
 * 
 * This script tests the presence functionality:
 * - USER_ONLINE broadcast when user connects
 * - USER_OFFLINE broadcast when user disconnects
 * - GET_ONLINE_USERS request and ONLINE_USERS response
 * - Multi-device support
 */

const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

// Create mock JWT tokens (these should match your JWT_SECRET in .env)
// For testing, we'll use sample tokens - replace with actual tokens
const USER1_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTNiZGM3M2UxZDA5MDY1OGFhOTI2ODUiLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc4MjMwODAzMCwiZXhwIjoxNzgyMzE4ODMwfQ.gNCLqb62T1YeJfylFVkRuPfx26HDNzq5OKaeyu_znhY';
const USER2_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTNiZGM5YmUxZDA5MDY1OGFhOTI2ODYiLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc4MjMwODA0MCwiZXhwIjoxNzgyMzE4ODQwfQ.mFWonc-tNSZBe_Lq-lBL_l1VEMBDOewfUJWIQSHfkAQ';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = (prefix, message, color = colors.reset) => {
  console.log(`${color}${colors.bright}[${prefix}]${colors.reset} ${message}`);
};

// Test 1: Basic presence functionality
const testBasicPresence = () => {
  log('TEST 1', 'Testing basic presence functionality...', colors.cyan);
  
  // Create User 1 connection
  const user1Socket = io(SERVER_URL, {
    auth: {
      token: USER1_TOKEN,
    },
    transports: ['websocket'],
  });

  user1Socket.on('connect', () => {
    log('USER 1', 'Connected to server', colors.green);
  });

  user1Socket.on('registered', (data) => {
    log('USER 1', `Registered: ${JSON.stringify(data)}`, colors.green);
    
    // Request online users
    user1Socket.emit('get-online-users');
  });

  user1Socket.on('online-users', (data) => {
    log('USER 1', `Online users: ${JSON.stringify(data.userIds)}`, colors.blue);
    
    // Now connect User 2
    connectUser2(user1Socket);
  });

  user1Socket.on('user-online', (data) => {
    log('USER 1', `User came online: ${data.userId}`, colors.yellow);
  });

  user1Socket.on('user-offline', (data) => {
    log('USER 1', `User went offline: ${data.userId}`, colors.yellow);
  });

  user1Socket.on('error', (error) => {
    log('USER 1', `Socket error: ${JSON.stringify(error)}`, colors.red);
  });

  user1Socket.on('connect_error', (error) => {
    log('USER 1', `Connection error: ${error.message}`, colors.red);
  });
};

const connectUser2 = (user1Socket) => {
  log('TEST 2', 'Connecting User 2...', colors.cyan);
  
  const user2Socket = io(SERVER_URL, {
    auth: {
      token: USER2_TOKEN,
    },
    transports: ['websocket'],
  });

  user2Socket.on('connect', () => {
    log('USER 2', 'Connected to server', colors.green);
  });

  user2Socket.on('registered', (data) => {
    log('USER 2', `Registered: ${JSON.stringify(data)}`, colors.green);
    
    // Request online users
    user2Socket.emit('get-online-users');
  });

  user2Socket.on('online-users', (data) => {
    log('USER 2', `Online users: ${JSON.stringify(data.userIds)}`, colors.blue);
    
    // Test disconnection after 3 seconds
    setTimeout(() => {
      testDisconnection(user1Socket, user2Socket);
    }, 3000);
  });

  user2Socket.on('user-online', (data) => {
    log('USER 2', `User came online: ${data.userId}`, colors.yellow);
  });

  user2Socket.on('user-offline', (data) => {
    log('USER 2', `User went offline: ${data.userId}`, colors.yellow);
  });

  user2Socket.on('error', (error) => {
    log('USER 2', `Socket error: ${JSON.stringify(error)}`, colors.red);
  });
};

const testDisconnection = (user1Socket, user2Socket) => {
  log('TEST 3', 'Testing user disconnection...', colors.cyan);
  
  // Disconnect User 2
  user2Socket.disconnect();
  log('USER 2', 'Disconnected', colors.magenta);
  
  // Wait 2 seconds then check online users again
  setTimeout(() => {
    user1Socket.emit('get-online-users');
    
    // Test multi-device support after 2 more seconds
    setTimeout(() => {
      testMultiDevice(user1Socket);
    }, 2000);
  }, 2000);
};

const testMultiDevice = (user1Socket) => {
  log('TEST 4', 'Testing multi-device support...', colors.cyan);
  
  // Create second connection for User 1
  const user1Socket2 = io(SERVER_URL, {
    auth: {
      token: USER1_TOKEN,
    },
    transports: ['websocket'],
  });

  user1Socket2.on('connect', () => {
    log('USER 1 (Device 2)', 'Connected to server', colors.green);
  });

  user1Socket2.on('registered', (data) => {
    log('USER 1 (Device 2)', `Registered: ${JSON.stringify(data)}`, colors.green);
    
    // No USER_ONLINE should be emitted since User 1 is already online
    log('TEST', 'User 1 should NOT trigger USER_ONLINE (already online)', colors.yellow);
    
    // Disconnect first device
    setTimeout(() => {
      user1Socket.disconnect();
      log('USER 1 (Device 1)', 'Disconnected', colors.magenta);
      log('TEST', 'User 1 should remain online (has Device 2)', colors.yellow);
      
      // Check online users
      setTimeout(() => {
        user1Socket2.emit('get-online-users');
        
        // Finally disconnect second device
        setTimeout(() => {
          user1Socket2.disconnect();
          log('USER 1 (Device 2)', 'Disconnected - User should now be offline', colors.magenta);
          
          // All tests complete
          setTimeout(() => {
            log('TESTS', 'All tests completed!', colors.green);
            process.exit(0);
          }, 2000);
        }, 3000);
      }, 2000);
    }, 3000);
  });

  user1Socket2.on('error', (error) => {
    log('USER 1 (Device 2)', `Socket error: ${JSON.stringify(error)}`, colors.red);
  });
};

// Start tests
console.log('\n' + colors.bright + '='.repeat(50) + colors.reset);
log('START', 'Starting Real-time Presence System Tests', colors.magenta);
console.log(colors.bright + '='.repeat(50) + colors.reset + '\n');

// Note: You need to have valid JWT tokens for testing
log('INFO', 'Make sure you have valid JWT tokens configured', colors.yellow);
log('INFO', 'You can generate test tokens using your auth endpoints', colors.yellow);
console.log('\n');

testBasicPresence();

// Handle process termination
process.on('SIGINT', () => {
  log('CLEANUP', 'Shutting down test client...', colors.yellow);
  process.exit(0);
});