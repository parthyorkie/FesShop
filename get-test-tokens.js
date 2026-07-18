/**
 * Script to get JWT tokens for testing
 * Creates or logs in test users and outputs their JWT tokens
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function getTestTokens() {
    try {
        console.log('Getting test JWT tokens...\n');
        
        // Test user 1
        const user1 = {
            email: 'testuser1@example.com',
            password: 'Test@123456',
            name: 'Test User 1'
        };
        
        // Test user 2
        const user2 = {
            email: 'testuser2@example.com',
            password: 'Test@123456',
            name: 'Test User 2'
        };
        
        // Try to login or register user 1
        let token1;
        try {
            const loginResponse1 = await axios.post(`${API_URL}/api/auth/login`, {
                email: user1.email,
                password: user1.password
            });
            token1 = loginResponse1.data.token;
            console.log('✓ User 1 logged in successfully');
        } catch (error) {
            // If login fails, try to register
            try {
                const registerResponse1 = await axios.post(`${API_URL}/api/auth/register`, user1);
                token1 = registerResponse1.data.token;
                console.log('✓ User 1 registered successfully');
            } catch (regError) {
                console.error('Failed to login/register user 1:', regError.response?.data || regError.message);
                return;
            }
        }
        
        // Try to login or register user 2
        let token2;
        try {
            const loginResponse2 = await axios.post(`${API_URL}/api/auth/login`, {
                email: user2.email,
                password: user2.password
            });
            token2 = loginResponse2.data.token;
            console.log('✓ User 2 logged in successfully');
        } catch (error) {
            // If login fails, try to register
            try {
                const registerResponse2 = await axios.post(`${API_URL}/api/auth/register`, user2);
                token2 = registerResponse2.data.token;
                console.log('✓ User 2 registered successfully');
            } catch (regError) {
                // If registration fails due to existing user, try login again with the password
                if (regError.response?.data?.message === 'User exists') {
                    try {
                        const loginResponse2 = await axios.post(`${API_URL}/api/auth/login`, {
                            email: user2.email,
                            password: user2.password
                        });
                        token2 = loginResponse2.data.token;
                        console.log('✓ User 2 exists, logged in successfully');
                    } catch (loginError2) {
                        console.error('Failed to login existing user 2:', loginError2.response?.data || loginError2.message);
                        console.log('Note: User exists but password might be different from test password');
                        return;
                    }
                } else {
                    console.error('Failed to login/register user 2:', regError.response?.data || regError.message);
                    return;
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('TEST JWT TOKENS:');
        console.log('='.repeat(60));
        console.log('\nUser 1 Token:');
        console.log(token1);
        console.log('\nUser 2 Token:');
        console.log(token2);
        console.log('\n' + '='.repeat(60));
        console.log('EXPORT COMMANDS:');
        console.log('='.repeat(60));
        console.log(`\nexport JWT_USER1="${token1}"`);
        console.log(`export JWT_USER2="${token2}"`);
        console.log('\n' + '='.repeat(60));
        console.log('RUN CALL RECOVERY TEST:');
        console.log('='.repeat(60));
        console.log('\nnode test-call-recovery.js');
        console.log('\nOr with tokens directly:');
        console.log(`\nJWT_USER1="${token1}" JWT_USER2="${token2}" node test-call-recovery.js`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Check if axios is installed
try {
    require('axios');
    getTestTokens();
} catch (error) {
    console.log('Installing axios...');
    require('child_process').execSync('npm install axios', { stdio: 'inherit' });
    console.log('Please run this script again: node get-test-tokens.js');
}