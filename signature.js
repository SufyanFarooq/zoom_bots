import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// Generates a valid SDK JWT for Zoom Meeting SDK (Web, v4.x)
export function generateSignature(meetingNumber, role) {
  const sdkKey = process.env.ZOOM_API_KEY;
  const sdkSecret = process.env.ZOOM_API_SECRET;
  if (!sdkKey || !sdkSecret) throw new Error('SDK Key/Secret missing');
  const iat = Math.floor(Date.now() / 1000) - 30; // issued at
  const exp = iat + 2 * 60 * 60; // valid for 2 hours
  const payload = {
    sdkKey: sdkKey,
    mn: meetingNumber,
    role: parseInt(role, 10),
    iat: iat,
    exp: exp,
    appKey: sdkKey,
    tokenExp: exp
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  return jwt.sign(payload, sdkSecret, { header });
} 