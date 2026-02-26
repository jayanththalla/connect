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

    const { db } = await connectToDatabase();
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');
    const usersCollection = db.collection('users');

    const userId = new ObjectId(decoded.userId);

    const conversations = await conversationsCollection
      .find({ participants: userId })
      .sort({ updatedAt: -1 })
      .toArray();

    // Enrich each conversation with participant details and last message
    const detailed = await Promise.all(
      conversations.map(async (conv) => {
        const participantDetails = await usersCollection
          .find({ _id: { $in: conv.participants } })
          .project({ password: 0 })
          .toArray();

        // Get last message from messages collection
        const lastMsg = await messagesCollection
          .find({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray();

        // Count unread messages
        const unreadCount = await messagesCollection.countDocuments({
          conversationId: conv._id,
          'sender._id': { $ne: userId },
          readBy: { $nin: [decoded.userId] },
        });

        return {
          ...conv,
          participants: participantDetails.map((p) => ({
            _id: p._id.toString(),
            username: p.username,
            email: p.email,
            avatar: p.avatar,
            status: p.status || 'offline',
            lastSeen: p.lastSeen,
          })),
          lastMessage: lastMsg[0] || null,
          unreadCount,
        };
      })
    );

    return NextResponse.json(detailed);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = verifyToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { participantId } = body;

    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const conversationsCollection = db.collection('conversations');
    const usersCollection = db.collection('users');

    const userId = new ObjectId(decoded.userId);
    const otherId = new ObjectId(participantId);

    // Verify the other user exists
    const otherUser = await usersCollection.findOne({ _id: otherId });
    if (!otherUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if DM conversation already exists
    let conversation = await conversationsCollection.findOne({
      type: 'dm',
      participants: { $all: [userId, otherId] },
    });

    if (!conversation) {
      const result = await conversationsCollection.insertOne({
        type: 'dm',
        participants: [userId, otherId],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      conversation = {
        _id: result.insertedId,
        type: 'dm',
        participants: [userId, otherId],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Return with enriched participant details
    const participantDetails = await usersCollection
      .find({ _id: { $in: conversation.participants } })
      .project({ password: 0 })
      .toArray();

    return NextResponse.json(
      {
        ...conversation,
        participants: participantDetails.map((p) => ({
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
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
