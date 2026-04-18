import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import User from '../models/User';
import { sendResetEmail, sendSuccessEmail } from '../services/emailService';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';

export const register = async (req: Request, res: Response) => {
  const { email, password, name,role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'User exists' });

  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({ email, password: hashed, name, role });
  await sendSuccessEmail(email);

  res.json({ message: 'Registered', user: { id: user._id, email: user.email, name: user.name } });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

  const accessToken = generateAccessToken(user._id.toString(), user.role);
  const refreshToken = generateRefreshToken(user._id.toString());

  res.json({ accessToken, refreshToken, user: { id: user._id, email: user.email, name: user.name } });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  console.log('Forgot password request for:', email);

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const otp = generateOTP();

  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 3600000); // 1 hr

  await user.save();

  console.log('Generated reset token:', otp);
  await sendResetEmail(email, otp, user.name);
   console.log('Reset email sent to:', email);

  res.json({ message: 'Reset email sent' });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, otp, password } = req.body;

  const user = await User.findOne({
    email: email,
    otp: otp,
    otpExpiry: { $gt: new Date() },
  });

  if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

  user.password = await bcrypt.hash(password, 10);
  user.otp = undefined;
  user.otpExpiry = undefined;

  await user.save();

  res.json({ message: 'Password reset successful' });
};

export const logout = async (req: Request, res: Response) => {
  // Since JWT is stateless, we just return success
  // Client should remove the token from storage
  res.json({ message: 'Logged out successfully' });
};