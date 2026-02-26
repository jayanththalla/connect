import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyToken } from '@/lib/auth-middleware';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const decoded = verifyToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const users = await usersCollection
      .find({
        _id: { $ne: new ObjectId(decoded.userId) },
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
      })
      .project({ password: 0 })
      .limit(10)
      .toArray();

    return NextResponse.json(
      users.map((user) => ({
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio || '',
        status: user.status || 'offline',
        lastSeen: user.lastSeen,
      }))
    );
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
