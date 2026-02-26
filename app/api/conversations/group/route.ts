import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyToken } from '@/lib/auth-middleware';
import { connectToDatabase } from '@/lib/mongodb';

export async function POST(request: NextRequest) {
  try {
    const decoded = verifyToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, participantIds } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    if (!participantIds || participantIds.length === 0) {
      return NextResponse.json({ error: 'At least one participant is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const conversationsCollection = db.collection('conversations');
    const usersCollection = db.collection('users');

    const userId = new ObjectId(decoded.userId);

    // Build ObjectId array: creator + selected participants
    const allParticipantIds = [
      userId,
      ...participantIds.map((id: string) => new ObjectId(id)),
    ];

    // Verify all participants exist
    const existingUsers = await usersCollection
      .find({ _id: { $in: allParticipantIds } })
      .project({ password: 0 })
      .toArray();

    if (existingUsers.length === 0) {
      return NextResponse.json({ error: 'No valid participants found' }, { status: 404 });
    }

    // Create group conversation — participants stored as ObjectId[] for consistent querying
    const groupDoc = {
      type: 'group' as const,
      name: name.trim(),
      participants: allParticipantIds,
      creator: decoded.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await conversationsCollection.insertOne(groupDoc);

    // Return enriched response
    return NextResponse.json(
      {
        _id: result.insertedId.toString(),
        ...groupDoc,
        participants: existingUsers.map((p) => ({
          _id: p._id.toString(),
          username: p.username,
          email: p.email,
          avatar: p.avatar,
          status: p.status || 'offline',
          lastSeen: p.lastSeen,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating group conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
