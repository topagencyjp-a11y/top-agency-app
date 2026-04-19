import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'top-sales-secret';

export function createToken(user: { id: string; name: string; role: string }) {
  return jwt.sign(user, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, SECRET) as { id: string; name: string; role: string };
  } catch {
    return null;
  }
}
