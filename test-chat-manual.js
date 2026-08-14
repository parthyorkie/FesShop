/**
 * Interactive Manual Chat Test CLI
 * Usage:
 *   node test-chat-manual.js <CONVERSATION_ID> <JWT_USER_1> <JWT_USER_2>
 *
 * Or set environment variables:
 *   CONVERSATION_ID="..." JWT_USER1="..." JWT_USER2="..." node test-chat-manual.js
 */

const { io } = require('socket.io-client');
const readline = require('readline');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const conversationId = process.argv[2] || process.env.CONVERSATION_ID;
const tokenUser1 = process.argv[3] || process.env.JWT_USER1;
const tokenUser2 = process.argv[4] || process.env.JWT_USER2;

if (!conversationId || !tokenUser1 || !tokenUser2) {
  console.log(`
==========================================================
 💬 CHAT SOCKET MANUAL TEST CLI
==========================================================
Usage:
  node test-chat-manual.js <CONVERSATION_ID> <TOKEN_USER_1> <TOKEN_USER_2>

Or pass via environment variables:
  export CONVERSATION_ID="your_conversation_id"
  export JWT_USER1="token_for_user_1"
  export JWT_USER2="token_for_user_2"
  node test-chat-manual.js
==========================================================
`);
  process.exit(1);
}

console.log(`Connecting sockets to ${SERVER_URL}...`);

// Create Socket 1 (Sender / User 1)
const socket1 = io(SERVER_URL, {
  auth: { token: tokenUser1 },
  transports: ['websocket'],
});

// Create Socket 2 (Receiver / User 2)
const socket2 = io(SERVER_URL, {
  auth: { token: tokenUser2 },
  transports: ['websocket'],
});

let connectedCount = 0;

function setupChat() {
  connectedCount++;
  if (connectedCount < 2) return;

  console.log('\n✅ Both sockets connected successfully via Socket.IO authentication!');

  // User 1 joins room
  socket1.emit('chat:join', { conversationId }, (res) => {
    console.log(`[User 1] Joined room ${conversationId}:`, res);
  });

  // User 2 joins room
  socket2.emit('chat:join', { conversationId }, (res) => {
    console.log(`[User 2] Joined room ${conversationId}:`, res);
  });

  // User 1 listens for messages
  socket1.on('message:new', (msg) => {
    console.log(`\n📩 [User 1 received message:new]:`);
    console.log(JSON.stringify(msg, null, 2));
  });

  // User 2 listens for messages
  socket2.on('message:new', (msg) => {
    console.log(`\n📩 [User 2 received message:new]:`);
    console.log(JSON.stringify(msg, null, 2));
  });

  // Error listeners
  socket1.on('chat:error', (err) => console.error('❌ [User 1 chat:error]:', err));
  socket2.on('chat:error', (err) => console.error('❌ [User 2 chat:error]:', err));

  console.log(`
==========================================================
 🚀 INTERACTIVE CHAT TEST READY!
 Type a message and press ENTER to send from User 1 to User 2.
 Type 'exit' or Ctrl+C to quit.
==========================================================
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('line', (line) => {
    const text = line.trim();
    if (text.toLowerCase() === 'exit') {
      process.exit(0);
    }
    if (!text) return;

    const clientMessageId = `msg-${Date.now()}`;
    console.log(`\n📤 [User 1 sending message:send] "${text}"...`);

    socket1.emit(
      'message:send',
      {
        conversationId,
        clientMessageId,
        type: 'text',
        text,
      },
      (ack) => {
        console.log(`[User 1 message:send ACK]:`, ack);
      }
    );
  });
}

socket1.on('connect', () => {
  console.log('✓ User 1 socket connected:', socket1.id);
  setupChat();
});

socket1.on('connect_error', (err) => {
  console.error('❌ User 1 socket auth failed:', err.message);
});

socket2.on('connect', () => {
  console.log('✓ User 2 socket connected:', socket2.id);
  setupChat();
});

socket2.on('connect_error', (err) => {
  console.error('❌ User 2 socket auth failed:', err.message);
});
