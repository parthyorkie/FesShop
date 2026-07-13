import { OAuth2Client } from 'google-auth-library';
import { createUser, findByEmail } from '../repositories/user.repository';
import { createApiError } from '../utils/ApiError';
import { generateAccessToken } from '../utils/jwt';
import { trackEvent } from './socialProof.service';
import { SocialProofEventType } from '../models/socialProofEvent.model';
import { logger } from '../utils/logger';

// Initialize OAuth2Client with Google Client ID
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLoginService = async (idToken: string) => {
  try {
    // Verify the Google ID Token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw createApiError(400, 'Invalid Google token payload');
    }

    console.log("getPayload", payload)
    // Extract necessary information from Google payload
    const { email, name, picture, sub } = payload;

    if (!email || !name) {
      throw createApiError(400, 'Incomplete Google profile information');
    }

    // Find existing user by email
    let user = await findByEmail(email);

    // Create user if not found
    if (!user) {
      user = await createUser({
        email,
        name,
        googleId: sub,
        profilePicture: picture,
        role: 'ADMIN',
        isDeleted: false,
      });
      console.log('New user created via Google Auth:', user.email);
    }

    // Generate JWT access token
    const accessToken = generateAccessToken(user._id.toString(), user.role);

    console.log('Google login successful for:', user.email);

    // ✅ SOCIAL PROOF: Trigger SIGNUP event (non-blocking — must not fail registration)
      try {
        logger.info(
          `[SocialProof] Signup social proof triggered - userId: ${user._id}, email: ${user.email}`
        );
    
        await trackEvent({
          type: SocialProofEventType.SIGNUP,
          userId: user._id.toString(),
          metadata: {
            name: user.name,
            email: user.email,
          },
        });
      } catch (socialProofErr: any) {
        // ✅ ERROR HANDLING: Social proof failure must NOT fail user registration
        logger.error(
          `[SocialProof] Social proof tracking failed after signup - userId: ${user._id}, email: ${user.email} - Error: ${socialProofErr.message}`
        );
      }

    // Return authenticated session data
    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        role: user.role,
      },
      accessToken,
    };
  } catch (error: any) {
    console.error('Google verification failure:', error.message);

    // Pass through known operational errors
    if (error.isOperational) {
      throw error;
    }

    // Wrap unexpected errors in ApiError
    throw createApiError(401, 'Invalid Google token or verification failed');
  }
};
