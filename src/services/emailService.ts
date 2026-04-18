import nodemailer from 'nodemailer';
import { resetPasswordTemplate } from '../templates/resetPassword.template';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendResetEmail = async (email: string, otp: string, name: string) => {
  const html = resetPasswordTemplate({
    otp,
    name,
    appName: "FesShop",
  });


  await transporter.sendMail({
    to: email,
    subject: 'Password Reset',
    html: html,
  });
};

export const sendSuccessEmail = async (email: string) => {
  await transporter.sendMail({
    to: email,
    subject: 'Registration Successful',
    html: `<h3>Welcome to our app!</h3><p>You have been successfully registered.</p>`,
  });
};