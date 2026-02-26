import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        // Update user status to offline and set lastSeen
        await usersCollection.updateOne(
          { _id: new ObjectId(decoded.userId) },
          {
            $set: {
              status: 'offline',
              lastSeen: new Date(),
            },
          }
        );
      } catch {
        // Token might be invalid, still proceed with logout
      }
    }

    const response = NextResponse.json(
      { message: 'Logout successful' },
      { status: 200 }
    );

    response.cookies.set('auth_token', '', {
      httpOnly: true,
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
