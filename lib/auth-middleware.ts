import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export function verifyToken(request: NextRequest): { userId: string; email: string } | null {
  try {
    // Check Authorization header first (for cross-origin requests)
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Fall back to cookie (for same-origin requests)
    if (!token) {
      token = request.cookies.get('auth_token')?.value || null;
    }

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
    };

    return decoded;
  } catch (error) {
    return null;
  }
}
