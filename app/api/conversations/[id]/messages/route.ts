import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyToken } from '@/lib/auth-middleware';
import { connectToDatabase } from '@/lib/mongodb';

// Simple HTML sanitization to prevent XSS
function sanitize(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// GET — Load messages with pagination
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = verifyToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    const { db } = await connectToDatabase();
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');

    // Verify user is a participant
    const conversation = await conversationsCollection.findOne({
      _id: new ObjectId(id),
      participants: new ObjectId(decoded.userId),
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const totalMessages = await messagesCollection.countDocuments({
      conversationId: new ObjectId(id),
    });

    // Get messages sorted newest-first for pagination, then reverse for display
    const messages = await messagesCollection
      .find({ conversationId: new ObjectId(id) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total: totalMessages,
        totalPages: Math.ceil(totalMessages / limit),
        hasMore: skip + limit < totalMessages,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Send a new message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = verifyToken(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');
    const usersCollection = db.collection('users');

    // Verify user is a participant
    const conversation = await conversationsCollection.findOne({
      _id: new ObjectId(id),
      participants: new ObjectId(decoded.userId),
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get sender info
    const sender = await usersCollection.findOne({
      _id: new ObjectId(decoded.userId),
    });

    if (!sender) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    // Sanitize message content
    const sanitizedContent = sanitize(content.trim());

    const message: any = {
      _id: new ObjectId(),
      conversationId: new ObjectId(id),
      content: sanitizedContent,
      sender: {
        _id: new ObjectId(decoded.userId),
        username: sender.username,
        avatar: sender.avatar,
      },
      readBy: [decoded.userId],
      createdAt: new Date(),
    };

    // Add replyTo if replying to a message
    if (body.replyTo) {
      message.replyTo = {
        _id: body.replyTo._id,
        content: sanitize(body.replyTo.content || ''),
        sender: { username: body.replyTo.sender?.username || 'Unknown' },
      };
    }

    // Insert into separate messages collection
    await messagesCollection.insertOne(message);

    // Update conversation's lastMessage and timestamp
    await conversationsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          lastMessage: sanitizedContent,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
