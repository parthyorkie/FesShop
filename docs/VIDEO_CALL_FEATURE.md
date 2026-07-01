# Video Call Feature - Architecture & Working

## Overview

The video call feature implements **WebRTC peer-to-peer** calling with **Socket.IO signaling**. The server acts as a signaling relay — it does **not** handle media streams. Audio/video flows directly between clients via WebRTC.

---

## Architecture Diagram

```mermaid
graph TB
    subgraph Client A - Caller
        CA_APP[React Native App]
        CA_WEBRTC[WebRTC Engine]
    end

    subgraph Server
        SIO[Socket.IO Server]
        AUTH[Socket Auth Middleware]
        PS[Presence Service]
        VCS[Video Call Service]
        VCSocket[Video Call Socket Handler]
        DB[(MongoDB - CallHistory)]
        OS[OneSignal Push Service]
    end

    subgraph Client B - Receiver
        CB_APP[React Native App]
        CB_WEBRTC[WebRTC Engine]
    end

    CA_APP <-->|Socket.IO Events| SIO
    CB_APP <-->|Socket.IO Events| SIO
    SIO --> AUTH
    AUTH --> VCSocket
    VCSocket --> PS
    VCSocket --> VCS
    VCS --> DB
    VCSocket --> OS
    CA_WEBRTC <-.->|Peer-to-Peer Media Stream| CB_WEBRTC

    style CA_WEBRTC fill:#4CAF50,color:#fff
    style CB_WEBRTC fill:#4CAF50,color:#fff
    style SIO fill:#2196F3,color:#fff
    style DB fill:#FF9800,color:#fff
```

---

## File Structure

| File | Purpose |
|------|---------|
| `socket/videoCall.socket.ts` | Main socket handler — routes all signaling events |
| `services/videoCall.service.ts` | Call history CRUD — persists call records to MongoDB |
| `services/presence.service.ts` | In-memory user presence — tracks who is online |
| `interfaces/videoCall.interface.ts` | TypeScript types for all payloads |
| `constants/videoCall.constants.ts` | Event names, status enums, timeouts |
| `validators/videoCall.validator.ts` | Joi schemas for payload validation |
| `middlewares/socketAuth.middleware.ts` | JWT auth on socket connection |
| `models/callHistory.model.ts` | Mongoose schema for call records |
| `utils/videoCall.logger.ts` | Structured logging for call events |
| `types/socket.types.ts` | Typed Socket.IO server/socket definitions |

---

## Connection & Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant SocketIO as Socket.IO Server
    participant AuthMW as Auth Middleware
    participant Presence as Presence Service

    Client->>SocketIO: Connect (JWT in auth.token)
    SocketIO->>AuthMW: socketAuthMiddleware()
    AuthMW->>AuthMW: Extract & verify JWT
    AuthMW->>AuthMW: Lookup user in DB
    alt Token Valid
        AuthMW->>SocketIO: next() — attach user to socket.data
        SocketIO->>Client: Connected ✓
        SocketIO->>Presence: registerUser(userId, socketId)
        Presence-->>Presence: Store userId ↔ socketId mapping
        SocketIO->>Client: emit("registered", { userId })
        SocketIO-->>SocketIO: broadcast("user-online", { userId })
    else Token Invalid
        AuthMW->>Client: Error — Connection refused
    end
```

---

## Complete Call Flow (Happy Path)

```mermaid
sequenceDiagram
    participant Caller
    participant Server
    participant Receiver

    Note over Caller,Receiver: Both users are connected & registered

    Caller->>Server: "call-user" { callerId, receiverId, offer }
    Server->>Server: Validate payload (Joi)
    Server->>Server: Check caller not already in call
    Server->>Server: Create CallHistory record (status: MISSED)
    Server->>Server: Track ActiveCall in memory
    Server->>Server: Start 30s timeout timer
    Server->>Receiver: "incoming-call" { callerId, callerName, offer, callRecordId }

    Note over Server: ICE candidates are BUFFERED until call is answered

    Caller->>Server: "ice-candidate" { receiverId, candidate }
    Server->>Server: Buffer candidate (forReceiver[])
    Receiver->>Server: "ice-candidate" { receiverId: callerId, candidate }
    Server->>Server: Buffer candidate (forCaller[])

    Receiver->>Server: "answer-call" { callerId, answer }
    Server->>Server: Clear timeout timer
    Server->>Server: Mark call ANSWERED in DB
    Server->>Caller: "call-answered" { receiverId, receiverName, answer }
    Server->>Caller: Flush buffered ICE candidates (forCaller)
    Server->>Receiver: Flush buffered ICE candidates (forReceiver)

    Note over Caller,Receiver: WebRTC peer connection established
    Note over Caller,Receiver: Audio/Video flows P2P (not through server)

    Caller->>Server: "ice-candidate" (trickle)
    Server->>Receiver: "ice-candidate" (forwarded directly)

    Note over Caller,Receiver: Call in progress...

    Caller->>Server: "end-call" { receiverId }
    Server->>Server: Mark call COMPLETED in DB (calculate duration)
    Server->>Server: Clear ActiveCall tracking
    Server->>Receiver: "call-ended" { endedBy, reason }
```

---

## Call Rejection Flow

```mermaid
sequenceDiagram
    participant Caller
    participant Server
    participant Receiver

    Caller->>Server: "call-user" { callerId, receiverId, offer }
    Server->>Receiver: "incoming-call" { ... }

    Receiver->>Server: "reject-call" { receiverId: callerId }
    Server->>Server: Mark call REJECTED in DB
    Server->>Server: Clear ActiveCall tracking
    Server->>Caller: "call-rejected" { receiverId, reason }
```

---

## Missed Call Flow (Timeout)

```mermaid
sequenceDiagram
    participant Caller
    participant Server
    participant Receiver
    participant OneSignal

    Caller->>Server: "call-user" { callerId, receiverId, offer }
    Server->>Receiver: "incoming-call" { ... }
    Server->>Server: Start 30s timeout

    Note over Receiver: Does not answer...

    Server->>Server: ⏰ Timeout fires after 30s
    Server->>Server: Mark call MISSED in DB
    Server->>Caller: "call-ended" { endedBy: "system", reason: "Call not answered" }
    Server->>OneSignal: Send missed call push notification
    OneSignal->>Receiver: Push notification: "Missed call from ..."
    Server->>Server: Clear ActiveCall tracking
```

---

## Receiver Offline Flow

```mermaid
sequenceDiagram
    participant Caller
    participant Server
    participant OneSignal
    participant Receiver

    Caller->>Server: "call-user" { callerId, receiverId, offer }
    Server->>Server: presenceService.getSocketByUserId(receiverId)
    Server->>Server: Receiver NOT online
    Server->>Server: Create CallHistory (status: MISSED)
    Server->>OneSignal: Send push notification with call details
    Server->>Caller: error("USER_OFFLINE", "User is offline. Notification sent.")
```

---

## Disconnect & Reconnection Handling

```mermaid
sequenceDiagram
    participant User
    participant Server
    participant OtherUser

    Note over User,Server: User disconnects during active call

    User--xServer: Connection lost
    Server->>Server: Start 10s grace period (DISCONNECT_GRACE_MS)

    alt User reconnects within 10s
        User->>Server: Reconnect + register
        Server->>Server: Cancel grace period timer
        Server->>Server: Call state preserved ✓
        Note over User,OtherUser: Call continues seamlessly
    else User does NOT reconnect
        Server->>Server: ⏰ Grace period expires
        Server->>Server: Mark call COMPLETED in DB
        Server->>OtherUser: "call-ended" { reason: "User disconnected" }
        Server->>Server: broadcast("user-offline")
        Server->>Server: Clear ActiveCall tracking
    end
```

---

## In-Memory State Management

```mermaid
graph LR
    subgraph Presence Service
        UTS[userToSockets<br/>Map: userId → Set of socketId]
        STU[socketToUser<br/>Map: socketId → userId]
        SM[socketMetadata<br/>Map: socketId → PresenceUser]
    end

    subgraph Active Calls Tracking
        AC[activeCalls<br/>Map: callRecordId → ActiveCall]
        UTAC[userToActiveCall<br/>Map: participantId → callRecordId]
    end

    style UTS fill:#E3F2FD
    style STU fill:#E3F2FD
    style SM fill:#E3F2FD
    style AC fill:#FFF3E0
    style UTAC fill:#FFF3E0
```

### ActiveCall Object Structure:
```
{
  callRecordId: string        // MongoDB _id
  callerId: string            // Who initiated
  receiverId: string          // Who was called
  startedAt: Date
  answered: boolean           // Controls ICE buffering
  timeoutId: NodeJS.Timeout   // 30s unanswered timer
  disconnectTimeoutId: Timeout // 10s reconnect grace
  bufferedCandidates: {
    forCaller: ICECandidate[]   // From receiver, waiting for answer
    forReceiver: ICECandidate[] // From caller, waiting for answer
  }
}
```

---

## ICE Candidate Buffering Strategy

```mermaid
stateDiagram-v2
    [*] --> CallInitiated: call-user event

    CallInitiated --> BufferingICE: ICE candidates arrive
    BufferingICE --> BufferingICE: Buffer in forCaller[] / forReceiver[]

    BufferingICE --> CallAnswered: answer-call event
    CallAnswered --> FlushBuffered: Flush all buffered candidates
    FlushBuffered --> DirectForwarding: ICE candidates forwarded immediately

    DirectForwarding --> DirectForwarding: New ICE candidates (trickle)
    DirectForwarding --> [*]: Call ends
```

**Why buffer?** WebRTC ICE candidates can arrive before the answer SDP is set on the remote peer. Forwarding them too early causes them to be dropped. The server buffers all candidates until `answer-call` is received, then flushes them in order.

---

## Socket Events Reference

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `register-user` | — | Register for calls (auto-called on connect) |
| `get-online-users` | — | Request list of online user IDs |
| `call-user` | `{ callerId, receiverId, offer }` | Initiate a call with WebRTC offer |
| `answer-call` | `{ callerId, answer }` | Answer incoming call with WebRTC answer |
| `ice-candidate` | `{ receiverId, candidate }` | Send ICE candidate to peer |
| `reject-call` | `{ receiverId }` | Reject an incoming call |
| `end-call` | `{ receiverId }` | End an active call |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `registered` | `{ userId, message }` | Registration confirmed |
| `online-users` | `{ userIds[] }` | List of online users |
| `incoming-call` | `{ callerId, callerName, offer, callRecordId }` | Incoming call notification |
| `call-answered` | `{ receiverId, receiverName, answer }` | Call was answered |
| `ice-candidate` | `{ senderId, candidate }` | ICE candidate from peer |
| `call-rejected` | `{ receiverId, reason }` | Call was rejected |
| `call-ended` | `{ endedBy, reason }` | Call was ended |
| `user-online` | `{ userId, userName }` | A user came online |
| `user-offline` | `{ userId, userName }` | A user went offline |
| `error` | `{ code, message, details? }` | Error occurred |

---

## Call Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> MISSED: Call record created

    MISSED --> ANSWERED: Receiver picks up
    MISSED --> REJECTED: Receiver rejects
    MISSED --> MISSED: Timeout (30s) — remains MISSED

    ANSWERED --> COMPLETED: Either party ends call
    ANSWERED --> COMPLETED: Disconnect (after grace period)

    REJECTED --> [*]
    MISSED --> [*]
    COMPLETED --> [*]
```

---

## Configuration Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `CALL_TIMEOUT_MS` | 30,000ms (30s) | Time to wait before marking call as missed |
| `DISCONNECT_GRACE_MS` | 10,000ms (10s) | Grace period for reconnection during call |
| `MAX_ICE_CANDIDATES` | 50 | Max buffered ICE candidates |
| `pingTimeout` | 60,000ms | Socket.IO ping timeout |
| `pingInterval` | 25,000ms | Socket.IO ping interval |

---

## Error Codes

| Code | When |
|------|------|
| `UNAUTHORIZED` | Invalid JWT or caller ID mismatch |
| `USER_NOT_FOUND` | Receiver doesn't exist or is deleted |
| `USER_OFFLINE` | Receiver has no active socket connection |
| `INVALID_PAYLOAD` | Joi validation failed on event payload |
| `CALL_FAILED` | Already in call, or no active call found |
| `INTERNAL_ERROR` | Unexpected server error |

---

## Database Schema (CallHistory)

```mermaid
erDiagram
    CALL_HISTORY {
        ObjectId _id PK
        ObjectId callerId FK "ref: User"
        ObjectId receiverId FK "ref: User"
        String status "MISSED | REJECTED | ANSWERED | COMPLETED"
        Date startedAt
        Date answeredAt "nullable"
        Date endedAt "nullable"
        Number duration "seconds, nullable"
        Date createdAt
        Date updatedAt
    }

    USER ||--o{ CALL_HISTORY : "makes calls"
    USER ||--o{ CALL_HISTORY : "receives calls"
```

---

## Multi-Device Support

The presence service supports **multiple sockets per user** (e.g., phone + tablet). Key behaviors:

- `userToSockets` maps each userId to a **Set of socketIds**
- `getSocketByUserId()` returns the **first** socket (for call routing)
- `removeBySocketId()` only marks user offline when the **last** socket disconnects
- `user-online` / `user-offline` events broadcast only on **first connect** / **last disconnect**

---

## Push Notifications (OneSignal)

When the receiver is **offline**, the server sends a push notification via OneSignal containing:
- Caller's name and ID
- Call record ID (for deep linking into the app)

When a call is **missed** (30s timeout), a separate missed call notification is sent.
