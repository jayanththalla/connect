import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyToken } from '@/lib/auth-middleware';
import { connectToDatabase } from '@/lib/mongodb';

// DELETE — Soft-delete a message (mark as deleted)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; messageId: string }> }
) {
    try {
        const decoded = verifyToken(request);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, messageId } = await params;
        const { db } = await connectToDatabase();
        const messagesCollection = db.collection('messages');

        // Find the message and verify the sender is the current user
        const message = await messagesCollection.findOne({
            _id: new ObjectId(messageId),
            conversationId: new ObjectId(id),
        });

        if (!message) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // Only the sender can delete their own message
        if (message.sender._id.toString() !== decoded.userId) {
            return NextResponse.json({ error: 'Cannot delete this message' }, { status: 403 });
        }

        // Soft delete — replace content and mark as deleted
        await messagesCollection.updateOne(
            { _id: new ObjectId(messageId) },
            {
                $set: {
                    content: '🚫 This message was deleted',
                    deleted: true,
                    deletedAt: new Date(),
                },
            }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
