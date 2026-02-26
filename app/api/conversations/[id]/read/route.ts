import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyToken } from '@/lib/auth-middleware';
import { connectToDatabase } from '@/lib/mongodb';

// POST — Mark all messages in a conversation as read by the current user
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

        // Add userId to readBy for all unread messages in this conversation
        const result = await messagesCollection.updateMany(
            {
                conversationId: new ObjectId(id),
                readBy: { $nin: [decoded.userId] },
            },
            {
                $addToSet: { readBy: decoded.userId },
            }
        );

        return NextResponse.json({
            markedRead: result.modifiedCount,
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
