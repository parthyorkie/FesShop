/**
 * OneSignal Push Notification Service
 * 
 * Sends push notifications for incoming video calls
 * when the receiver is offline.
 * 
 * Uses OneSignal REST API v2 directly (no library dependency).
 */

import { config } from '../config/config';
import { logNotificationSent, logNotificationError } from '../utils/videoCall.logger';
import { logger } from '../utils/logger';

const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications';

// OneSignal notification body interface
interface NotificationBody {
  app_id: string;
  include_external_user_ids?: string[];
  include_player_ids?: string[];
  headings?: { en: string };
  contents?: { en: string };
  data?: Record<string, unknown>;
  ios_sound?: string;
  ios_category?: string;
  content_available?: boolean;
  android_channel_id?: string;
  android_sound?: string;
  priority?: number;
  ttl?: number;
  collapse_id?: string;
  [key: string]: unknown;
}

/**
 * Check if OneSignal is configured
 */
const isReady = (): boolean => {
  const appId = config.ONESIGNAL_APP_ID;
  const apiKey = config.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    logger.warn('[OneSignal] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY - notifications disabled');
    return false;
  }
  return true;
};

/**
 * Send a notification via OneSignal REST API
 */
const sendNotification = async (body: NotificationBody): Promise<{ id?: string; errors?: string[] }> => {
  const apiKey = config.ONESIGNAL_REST_API_KEY!;

  const response = await fetch(ONESIGNAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    return { errors: data.errors || [data.message || `HTTP ${response.status}`] };
  }

  return data;
};

/**
 * Notification payload for incoming video call
 */
interface CallNotificationPayload {
  receiverExternalUserId: string;
  callerId: string;
  callerName: string;
  callRecordId?: string;
}

/**
 * Send push notification for incoming video call
 * 
 * @param payload - Notification details
 * @returns true if notification sent successfully, false otherwise
 */
export const sendCallNotification = async (
  payload: CallNotificationPayload
): Promise<boolean> => {
  const { receiverExternalUserId, callerId, callerName, callRecordId } = payload;

  try {
    if (!isReady()) {
      return false;
    }

    const notification: NotificationBody = {
      app_id: config.ONESIGNAL_APP_ID!,

      // Target user by external_user_id (should match MongoDB userId)
      include_external_user_ids: [receiverExternalUserId],
      
      // Notification content
      headings: { en: 'Incoming Call' },
      contents: { en: `${callerName} is calling you` },
      
      // Additional data for app handling
      data: {
        type: 'video_call',
        callerId,
        callerName,
        ...(callRecordId && { callRecordId }),
      },
      
      // iOS specific
      ios_sound: 'ringtone.wav',
      ios_category: 'INCOMING_CALL',
      content_available: true,
      
      // Android specific  
      android_channel_id: 'video_calls',
      android_sound: 'ringtone',
      priority: 10, // High priority for calls
      
      // TTL - call notifications should expire quickly
      ttl: 30, // 30 seconds
      
      // Collapse key - only latest call notification matters
      collapse_id: `call_${receiverExternalUserId}`,
    };

    const result = await sendNotification(notification);

    if (result.id) {
      logNotificationSent(receiverExternalUserId, 'video_call', true);
      logger.debug(`[OneSignal] Notification sent - id: ${result.id}, recipient: ${receiverExternalUserId}`);
      return true;
    }

    if (result.errors) {
      logNotificationError(receiverExternalUserId, result.errors.join(', '));
      return false;
    }

    logNotificationSent(receiverExternalUserId, 'video_call', false);
    return false;

  } catch (error: any) {
    logNotificationError(receiverExternalUserId, error.message || 'Unknown error');
    return false;
  }
};

/**
 * Send notification for missed call
 * 
 * @param receiverExternalUserId - User who missed the call
 * @param callerName - Name of the caller
 */
export const sendMissedCallNotification = async (
  receiverExternalUserId: string,
  callerName: string
): Promise<boolean> => {
  try {
    if (!isReady()) {
      return false;
    }

    const notification: NotificationBody = {
      app_id: config.ONESIGNAL_APP_ID!,
      include_external_user_ids: [receiverExternalUserId],
      headings: { en: 'Missed Call' },
      contents: { en: `You missed a call from ${callerName}` },
      data: {
        type: 'missed_call',
        callerName,
      },
      // Lower priority for missed call notifications
      priority: 5,
      ttl: 86400, // 24 hours
    };

    const result = await sendNotification(notification);
    return !!result.id;

  } catch (error: any) {
    logNotificationError(receiverExternalUserId, error.message || 'Missed call notification failed');
    return false;
  }
};

/**
 * Check if OneSignal is configured and ready
 */
export const isConfigured = (): boolean => {
  return !!(config.ONESIGNAL_APP_ID && config.ONESIGNAL_REST_API_KEY);
};

// Export as namespace
export const oneSignalService = {
  sendCallNotification,
  sendMissedCallNotification,
  isConfigured,
};
