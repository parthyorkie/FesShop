/**
 * Generate Test JWT Tokens for Presence Testing
 * 
 * Run this script to generate valid JWT tokens for testing the presence system
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Test users
const users = [
  {
    userId: '674586d1b6ac4b5bf0afccf7',
    email: 'test1@example.com',
    name: 'Test User 1',
    role: 'USER',
  },
  {
    userId: '674586d2b6ac4b5bf0afccfa',
    email: 'test2@example.com',
    name: 'Test User 2',
    role: 'USER',
  },
];

// Generate tokens
console.log('Generating test JWT tokens...\n');
console.log('JWT_SECRET from .env:', JWT_SECRET ? 'Found' : 'Not found');
console.log('\n' + '='.repeat(80) + '\n');

users.forEach((user, index) => {
  const token = jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  console.log(`USER ${index + 1} (${user.name}):`);
  console.log('User ID:', user.userId);
  console.log('Token:', `Bearer ${token}`);
  console.log('\n' + '-'.repeat(80) + '\n');
});

console.log('Copy these tokens and update test-presence.js with them.');
console.log('\nAlternatively, you can create real users via your API endpoints:');
console.log('1. POST /api/auth/register - to create users');
console.log('2. POST /api/auth/login - to get tokens');