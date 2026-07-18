/**
 * Manual Test Script for Socket.IO Reconnection
 * 
 * This script tests the reconnection foundation and presence safety features.
 * Run with: node test-reconnection.js
 */

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Configuration
const SERVER_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper functions
const log = (prefix, message, color = colors.reset) => {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}${prefix}${colors.reset}: ${message}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate test JWT tokens
const generateToken = (userId, name) => {
  return jwt.sign(
    { 
      userId, 
      name,
      email: `${userId}@example.com`,
      role: 'USER'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Test Scenarios
class ReconnectionTester {
  constructor() {
    this.sockets = [];
    this.testResults = [];
  }

  createSocket(userId, name, tag = '') {
    const token = generateToken(userId, name);
    const socket = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false, // Manual reconnection for testing
    });

    socket.tag = tag || `${name}-${Date.now()}`;
    
    socket.on('connect', () => {
      log(`CONNECT ${socket.tag}`, `Connected: ${socket.id}`, colors.green);
    });

    socket.on('registered', (data) => {
      log(`REGISTER ${socket.tag}`, `Registered: ${JSON.stringify(data)}`, colors.cyan);
    });

    socket.on('error', (error) => {
      log(`ERROR ${socket.tag}`, `Error: ${JSON.stringify(error)}`, colors.red);
    });

    socket.on('disconnect', (reason) => {
      log(`DISCONNECT ${socket.tag}`, `Disconnected: ${reason}`, colors.yellow);
    });

    socket.on('user-online', (data) => {
      log(`PRESENCE ${socket.tag}`, `User online: ${JSON.stringify(data)}`, colors.magenta);
    });

    socket.on('user-offline', (data) => {
      log(`PRESENCE ${socket.tag}`, `User offline: ${JSON.stringify(data)}`, colors.magenta);
    });

    this.sockets.push(socket);
    return socket;
  }

  async testQuickReconnection() {
    console.log(`\n${colors.bright}=== TEST 1: Quick Reconnection ===${colors.reset}`);
    console.log('Testing that reconnection replaces old socket without duplicates\n');

    const userId = 'test-user-1';
    const userName = 'TestUser1';

    // Initial connection
    const socket1 = this.createSocket(userId, userName, 'socket-1');
    
    await new Promise((resolve) => {
      socket1.on('registered', resolve);
    });

    await sleep(1000);

    // Simulate reconnection with new socket (before disconnect handler runs)
    log('TEST', 'Creating second socket for same user (simulating reconnection)...', colors.blue);
    const socket2 = this.createSocket(userId, userName, 'socket-2');

    await new Promise((resolve) => {
      socket2.on('registered', resolve);
    });

    await sleep(2000);

    // Check that socket1 was disconnected
    if (!socket1.connected && socket2.connected) {
      log('RESULT', '✅ Old socket was replaced by new socket', colors.green);
      this.testResults.push({ test: 'Quick Reconnection', passed: true });
    } else {
      log('RESULT', '❌ Socket replacement failed', colors.red);
      this.testResults.push({ test: 'Quick Reconnection', passed: false });
    }

    // Cleanup
    socket1.disconnect();
    socket2.disconnect();
    await sleep(1000);
  }

  async testMultipleRapidReconnections() {
    console.log(`\n${colors.bright}=== TEST 2: Multiple Rapid Reconnections ===${colors.reset}`);
    console.log('Testing that only the latest socket remains active\n');

    const userId = 'test-user-2';
    const userName = 'TestUser2';

    const sockets = [];
    
    // Create multiple sockets rapidly
    for (let i = 1; i <= 5; i++) {
      log('TEST', `Creating socket ${i}...`, colors.blue);
      const socket = this.createSocket(userId, userName, `rapid-${i}`);
      sockets.push(socket);
      
      await new Promise((resolve) => {
        socket.on('registered', resolve);
      });
      
      await sleep(200); // Small delay between connections
    }

    await sleep(2000);

    // Check that only the last socket is connected
    const connectedCount = sockets.filter(s => s.connected).length;
    const lastSocketConnected = sockets[sockets.length - 1].connected;

    if (connectedCount === 1 && lastSocketConnected) {
      log('RESULT', '✅ Only the latest socket remains connected', colors.green);
      this.testResults.push({ test: 'Multiple Rapid Reconnections', passed: true });
    } else {
      log('RESULT', `❌ Expected 1 connected socket (the last one), got ${connectedCount}`, colors.red);
      this.testResults.push({ test: 'Multiple Rapid Reconnections', passed: false });
    }

    // Cleanup
    sockets.forEach(s => s.disconnect());
    await sleep(1000);
  }

  async testStaleDisconnectHandling() {
    console.log(`\n${colors.bright}=== TEST 3: Stale Disconnect Handling ===${colors.reset}`);
    console.log('Testing that stale disconnects are ignored after reconnection\n');

    const userId = 'test-user-3';
    const userName = 'TestUser3';

    // Create observer socket to monitor presence
    const observer = this.createSocket('observer', 'Observer', 'observer');
    await new Promise((resolve) => {
      observer.on('registered', resolve);
    });

    let userOfflineReceived = false;
    observer.on('user-offline', (data) => {
      if (data.userId === userId) {
        userOfflineReceived = true;
        log('OBSERVER', `Detected user-offline for ${userId}`, colors.magenta);
      }
    });

    // Initial connection
    const socket1 = this.createSocket(userId, userName, 'stale-1');
    await new Promise((resolve) => {
      socket1.on('registered', resolve);
    });

    // Quick reconnection
    const socket2 = this.createSocket(userId, userName, 'stale-2');
    await new Promise((resolve) => {
      socket2.on('registered', resolve);
    });

    // Now disconnect socket1 (stale disconnect)
    socket1.disconnect();

    // Wait to see if user-offline is incorrectly broadcasted
    await sleep(3000);

    if (!userOfflineReceived && socket2.connected) {
      log('RESULT', '✅ Stale disconnect was ignored, user remained online', colors.green);
      this.testResults.push({ test: 'Stale Disconnect Handling', passed: true });
    } else {
      log('RESULT', '❌ User went offline when they should have remained online', colors.red);
      this.testResults.push({ test: 'Stale Disconnect Handling', passed: false });
    }

    // Cleanup
    socket2.disconnect();
    observer.disconnect();
    await sleep(1000);
  }

  async testPresenceBroadcast() {
    console.log(`\n${colors.bright}=== TEST 4: Presence Broadcast on Reconnection ===${colors.reset}`);
    console.log('Testing that user-online is not re-broadcasted on reconnection\n');

    const userId = 'test-user-4';
    const userName = 'TestUser4';

    // Create observer to monitor presence broadcasts
    const observer = this.createSocket('observer2', 'Observer2', 'observer2');
    await new Promise((resolve) => {
      observer.on('registered', resolve);
    });

    let onlineCount = 0;
    observer.on('user-online', (data) => {
      if (data.userId === userId) {
        onlineCount++;
        log('OBSERVER', `Detected user-online for ${userId} (count: ${onlineCount})`, colors.magenta);
      }
    });

    // Initial connection
    const socket1 = this.createSocket(userId, userName, 'presence-1');
    await new Promise((resolve) => {
      socket1.on('registered', resolve);
    });

    await sleep(1000);

    // Reconnection
    const socket2 = this.createSocket(userId, userName, 'presence-2');
    await new Promise((resolve) => {
      socket2.on('registered', resolve);
    });

    await sleep(2000);

    // Should only receive one user-online event (from initial connection)
    if (onlineCount === 1) {
      log('RESULT', '✅ user-online was broadcasted only once (no duplicate on reconnect)', colors.green);
      this.testResults.push({ test: 'Presence Broadcast on Reconnection', passed: true });
    } else {
      log('RESULT', `❌ user-online was broadcasted ${onlineCount} times (expected 1)`, colors.red);
      this.testResults.push({ test: 'Presence Broadcast on Reconnection', passed: false });
    }

    // Cleanup
    socket1.disconnect();
    socket2.disconnect();
    observer.disconnect();
    await sleep(1000);
  }

  async runAllTests() {
    console.log(`${colors.bright}${colors.cyan}`);
    console.log('=========================================');
    console.log('  Socket.IO Reconnection Test Suite');
    console.log('  PR-01: Reconnect Foundation & Safety');
    console.log('=========================================');
    console.log(`${colors.reset}`);

    await this.testQuickReconnection();
    await this.testMultipleRapidReconnections();
    await this.testStaleDisconnectHandling();
    await this.testPresenceBroadcast();

    // Summary
    console.log(`\n${colors.bright}=== TEST SUMMARY ===${colors.reset}\n`);
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      const color = result.passed ? colors.green : colors.red;
      console.log(`${color}${icon} ${result.test}${colors.reset}`);
    });

    console.log(`\n${colors.bright}Results: ${passed}/${total} tests passed${colors.reset}`);
    
    if (passed === total) {
      console.log(`${colors.green}${colors.bright}All tests passed! 🎉${colors.reset}`);
    } else {
      console.log(`${colors.red}${colors.bright}Some tests failed. Please review the implementation.${colors.reset}`);
    }

    // Exit
    process.exit(passed === total ? 0 : 1);
  }
}

// Run tests
const tester = new ReconnectionTester();
tester.runAllTests().catch(error => {
  console.error(`${colors.red}Test suite failed:${colors.reset}`, error);
  process.exit(1);
});