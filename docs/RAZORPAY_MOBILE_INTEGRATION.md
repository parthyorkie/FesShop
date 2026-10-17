# FesShop Razorpay Mobile Integration

Backend reference for the React Native checkout flow. The backend is authoritative for payable amount, payment state, and inventory.

## 1. Architecture and credentials

```text
React Native app               FesShop API                 Razorpay
      |                              |                         |
      | POST /payments/create-order  |                         |
      |----------------------------->| create gateway order    |
      |                              |------------------------>|
      |                              |<------------------------|
      | {orderId, amount, keyId}     |                         |
      |<-----------------------------|                         |
      | RazorpayCheckout.open(...)                             |
      |------------------------------------------------------->|
      |<-------------------------------------------------------|
      | checkout payment/order/signature                       |
      | POST /payments/verify     |                            |
      |-------------------------->| verify + commit order/stock|
      |                           |<----------------------------|
      |                           | POST /payments/webhook      |
      |                           |<----------------------------|
      |<===== Socket.IO payment:success / payment:failed ======|
```

Credential boundary:

- Backend only: `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`. Never put either in a mobile build, API response, log, or client source.
- Mobile app: `RAZORPAY_KEY_ID` only. It is a public identifier, not a signing credential.
- Use Razorpay test-mode credentials during development and live credentials only in production.

## 2. Backend API contracts

Base URL examples below use `https://<api-host>`. Authenticated endpoints require `Authorization: Bearer <access-token>` and `Content-Type: application/json`.

### Create gateway order

`POST /api/v1/payments/create-order`

Authentication: required.

Request:

```json
{
  "orderId": "665f1a4c9c1f4f3059b9d8a1"
}
```

`orderId` is the MongoDB ID of an existing FesShop order. The backend reads `totalAmount`; do not send or calculate the payable amount in the app.

Success: HTTP `201`.

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Payment order created",
  "data": {
    "razorpayOrderId": "order_...",
    "amount": 129900,
    "currency": "INR",
    "keyId": "rzp_test_..."
  }
}
```

`amount` is an integer in paise. `129900` means INR 1,299.00. Pass it to the SDK unchanged; do not multiply it by 100 again. A retry while the same FesShop order is pending returns its existing Razorpay order ID.

### Verify checkout result

`POST /api/v1/payments/verify`

Authentication: required. Submit the checkout result exactly as returned by Razorpay, plus the FesShop order ID.

Request:

```json
{
  "internalOrderId": "665f1a4c9c1f4f3059b9d8a1",
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "<checkout-signature>"
}
```

Success: HTTP `200`. `alreadyProcessed` is `true` when the webhook already committed this payment.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payment verified successfully",
  "data": {
    "success": true,
    "orderId": "665f1a4c9c1f4f3059b9d8a1",
    "alreadyProcessed": false
  }
}
```

On success, the backend validates the HMAC signature, changes the order to `PAID`, marks the transaction `SUCCESS`, and deducts inventory in one MongoDB transaction. The response is not a substitute for reconciling order state after a network timeout.

### Razorpay webhook

`POST /api/v1/payments/webhook`

Razorpay server-to-server only; no app auth. The backend verifies `X-Razorpay-Signature` against the unmodified raw request body. It handles `payment.captured`, `order.paid`, and `payment.failed` idempotently. The mobile app must never call this endpoint.

## 3. Socket.IO synchronization

Connect with the same access token used for REST:

```ts
const socket = io(API_ORIGIN, {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

After socket authentication, the backend automatically joins the user to `user:<userId>`. The client does not emit a room-join event. Register listeners after creating the socket and keep them registered across screen changes.

`payment:success`:

```ts
{
  orderId: string;
  transactionId: string;
  paymentStatus: 'PAID';
}
```

`payment:failed`:

```ts
{
  orderId: string;
  reason: string;
}
```

Socket events are live notifications, not a durable queue. On reconnect, app resume, or a missed event, fetch the FesShop order and use its `paymentStatus` as the source of truth. Existing read endpoint: `GET /api/orders/:id`; response data contains the order, including `paymentStatus` and `razorpayOrderId`. The current order-read route does not require auth; avoid treating it as an authorization boundary.

```ts
socket.on('payment:success', ({ orderId }) => reconcileOrder(orderId));
socket.on('payment:failed', ({ orderId, reason }) => {
  showPaymentFailure(reason);
  void reconcileOrder(orderId);
});
socket.on('connect', () => void reconcilePendingOrders());
```

## 4. React Native checkout

Install and link the native SDK following its current platform setup instructions:

```sh
npm install react-native-razorpay
cd ios && pod install && cd ..
```

Store `RAZORPAY_KEY_ID` in the app environment/configuration. Never include backend secrets. The app must first have a FesShop `orderId` (created through the project order flow).

Example using `fetch`; adapt the API origin and user prefill to the app. `amount` is already in paise from the backend.

```ts
import RazorpayCheckout from 'react-native-razorpay';

type CreateOrderResponse = {
  success: boolean;
  data: {
    razorpayOrderId: string;
    amount: number; // integer paise
    currency: 'INR';
    keyId: string;
  };
};

async function payForOrder(
  internalOrderId: string,
  accessToken: string,
  prefill: { name?: string; email?: string; contact?: string },
) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const createResponse = await fetch(`${API_ORIGIN}/api/v1/payments/create-order`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderId: internalOrderId }),
  });
  const createBody = await createResponse.json() as CreateOrderResponse;
  if (!createResponse.ok || !createBody.success) {
    throw new Error(createBody.data ? 'Unable to create payment order' : 'Order creation failed');
  }

  const gatewayOrder = createBody.data;
  if (!Number.isInteger(gatewayOrder.amount) || gatewayOrder.amount <= 0) {
    throw new Error('Backend returned an invalid paise amount');
  }

  let checkout: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };

  try {
    checkout = await RazorpayCheckout.open({
      key: gatewayOrder.keyId,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency,
      order_id: gatewayOrder.razorpayOrderId,
      name: 'FesShop',
      description: `Order ${internalOrderId}`,
      prefill,
      theme: { color: '#176B57' },
    });
  } catch (error) {
    const code = Number((error as { code?: number })?.code);
    if (code === 0) return { state: 'cancelled' as const };
    // Other SDK failures are not proof that payment failed; reconcile with backend.
    return await reconcileOrder(internalOrderId, accessToken);
  }

  try {
    const verifyResponse = await fetch(`${API_ORIGIN}/api/v1/payments/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        internalOrderId,
        razorpay_order_id: checkout.razorpay_order_id,
        razorpay_payment_id: checkout.razorpay_payment_id,
        razorpay_signature: checkout.razorpay_signature,
      }),
    });
    const verifyBody = await verifyResponse.json();
    if (!verifyResponse.ok || !verifyBody.success) {
      return await reconcileOrder(internalOrderId, accessToken);
    }
    return { state: 'paid' as const };
  } catch {
    // Network may fail after Razorpay captured payment. Never start a second payment
    // until reconciliation confirms that the order is still unpaid.
    return await reconcileOrder(internalOrderId, accessToken);
  }
}
```

`reconcileOrder` should call `GET ${API_ORIGIN}/api/orders/${internalOrderId}` and inspect `response.data.paymentStatus`. Treat `PAID` as success, `FAILED` as a failed attempt, and `UNPAID`/`PENDING` as unresolved; show a pending state and retry reconciliation rather than opening another checkout immediately.

## 5. State, retries, and error handling

Payment state rules:

```text
UNPAID / FAILED -> PENDING -> PAID
                         \-> FAILED (Razorpay failure webhook)
```

- `PAID` is terminal for checkout. Do not start another Razorpay order for it.
- The webhook and `/verify` may race. Both use the same transaction/order state; the first successful commit deducts stock once. A later valid `/verify` returns `alreadyProcessed: true`.
- If checkout succeeds but `/verify` times out, wait for `payment:success` or fetch the order. Retrying `/verify` with the original checkout values is safe; do not create another checkout unless reconciliation shows the order remains unpaid/failed.
- If the app is killed or backgrounded, reconnect the socket and fetch each pending order. The server does not replay events emitted while disconnected.
- A Razorpay SDK cancellation (`code === 0`) is a user cancellation, not a server-confirmed failed payment. Do not mark the order failed locally based only on that callback.
- MongoDB transactions require a replica-set deployment. Inventory shortage during payment capture aborts the database transaction; it needs operational reconciliation because gateway capture may already have succeeded.

Errors use `{ "success": false, "message": "..." }`; development may also include `stack`, and validation may include `errors`. The API does not currently return a stable `code` property. Normalize status/message in the app:

| HTTP / condition | Mobile mapping | Suggested UI handling |
| --- | --- | --- |
| `400`, invalid request or `Invalid payment signature` | `INVALID_SIGNATURE` | Do not show paid; reconcile order and report a retry/support option. |
| `401` | `AUTH_REQUIRED` | Refresh/login, then retry with the same order. |
| `403` | `ORDER_ACCESS_DENIED` | Stop checkout and report the access issue. |
| `404` | `ORDER_OR_PAYMENT_NOT_FOUND` | Refresh order details; do not retry checkout blindly. |
| `409`, `Insufficient stock for product ...` | `STOCK_EXHAUSTED` | Show unavailable item and contact support if Razorpay shows a capture. |
| `409`, already paid/order unavailable | `ORDER_STATE_CONFLICT` | Fetch order; `PAID` means success. |
| Network timeout / `5xx` / transaction abort | `TRANSACTION_ABORTED` | Keep pending and reconcile via socket plus `GET /api/orders/:id`. |
| SDK error code `0` | `USER_CANCELLED` | Return to cart/order screen without an error alert. |
| Gateway/session expiry reported by SDK | `PAYMENT_EXPIRED` | Reconcile first; create a new payment attempt only if order is not paid. |

These uppercase values are client-side mappings, not literal API response codes. In particular, `PAYMENT_EXPIRED` and `TRANSACTION_ABORTED` are not currently emitted by the backend as named codes.

## 6. Mobile smoke-test checklist

- [ ] Use Razorpay test mode and the current official test card/UPI values from Razorpay's test credentials documentation; never use live credentials for QA.
- [ ] Confirm create-order returns the server-calculated amount in paise and pass it unchanged to `RazorpayCheckout.open`.
- [ ] Complete a test payment; verify the app posts all three Razorpay response values plus `internalOrderId` to `/verify`.
- [ ] Cancel checkout and confirm SDK code `0` does not mark the FesShop order paid or failed.
- [ ] Deliver the webhook before the client verify call; confirm the order stays paid and stock is deducted only once.
- [ ] Simulate network loss during create-order, checkout, and `/verify`; ensure the app reconciles before retrying payment.
- [ ] Verify socket authentication uses the current JWT and receives `payment:success` and `payment:failed` in the authenticated user's room.
- [ ] Disconnect the app, complete a payment, reconnect, and confirm REST reconciliation recovers state when the socket event was missed.
- [ ] Send a duplicate webhook and confirm it does not deduct stock twice or emit another transition event.
- [ ] Validate invalid-signature and insufficient-stock handling; confirm UI does not falsely report payment success.
- [ ] Verify OneSignal order-confirmation push in the configured test app and confirm notifications are not required for payment correctness.