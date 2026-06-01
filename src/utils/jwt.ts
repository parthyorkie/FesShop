import jwt from 'jsonwebtoken';

export const generateAccessToken = (userId: string, role?: string) => {
  const payload = { userId, role: role || 'USER' };
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_ACCESS_SECRET!;
  const expiresIn = process.env.JWT_EXPIRES_IN || '30d';
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
};

export const verifyAccessToken = (token: string) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_ACCESS_SECRET!;
  return jwt.verify(token, secret);
};

export const generateRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: '7d',
  });
};