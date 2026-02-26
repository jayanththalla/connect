import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { MongoClient, ObjectId } from 'mongodb';

export const config = {
    api: {
        bodyParser: false,
    },
};

interface NextApiResponseWithSocket extends NextApiResponse {
    socket: any;
}

// Track userId -> socketId mapping for targeted messaging
const userSocketMap = new Map<string, string>();

// Persist user status to MongoDB
async function updateUserStatus(userId: string, status: 'online' | 'offline') {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) return;
        const client = new MongoClient(uri);
        await client.connect();
        const db = client.db('connect_app');
        const update: any = { status, updatedAt: new Date() };
        if (status === 'offline') {
            update.lastSeen = new Date();
        }
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: update }
        );
        await client.close();
    } catch (e) {
        console.error('[Socket.io] Failed to update user status:', e);
    }
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
    if (res.socket.server.io) {
        res.end();
        return;
    }

    console.log('[Socket.io] Initializing...');
    const io = new SocketIOServer(res.socket.server, {
        path: '/api/socket',
        addTrailingSlash: false,
    });
    res.socket.server.io = io;

    io.on('connection', (socket: Socket) => {
        console.log(`[Socket.io] Connected: ${socket.id}`);

        // User registers their userId on connect
        socket.on('user-connected', (userId: string) => {
            userSocketMap.set(userId, socket.id);
            (socket as any).userId = userId;
            console.log(`[Socket.io] User ${userId} mapped to socket ${socket.id}`);

            // Persist online status to DB
            updateUserStatus(userId, 'online');

            // Broadcast online status to all connected clients
            io.emit('user-status-changed', { userId, status: 'online' });
        });

        // Join a conversation room
        socket.on('join-conversation', (conversationId: string) => {
            socket.join(`conversation:${conversationId}`);
        });

        // Leave a conversation room
        socket.on('leave-conversation', (conversationId: string) => {
            socket.leave(`conversation:${conversationId}`);
        });

        // Handle new message — broadcast to room excluding sender
        socket.on('send-message', (data: { conversationId: string; message: any }) => {
            socket.to(`conversation:${data.conversationId}`).emit('receive-message', data.message);
        });

        // Handle typing indicator
        socket.on('typing', (data: { conversationId: string; username: string }) => {
            socket.to(`conversation:${data.conversationId}`).emit('user-typing', {
                conversationId: data.conversationId,
                username: data.username,
            });
        });

        // Handle stop typing
        socket.on('stop-typing', (data: { conversationId: string }) => {
            const conversationId = typeof data === 'string' ? data : data.conversationId;
            socket.to(`conversation:${conversationId}`).emit('user-stop-typing', {
                conversationId,
            });
        });

        // Handle read receipts
        socket.on('mark-read', (data: { conversationId: string; userId: string }) => {
            socket.to(`conversation:${data.conversationId}`).emit('messages-read', {
                conversationId: data.conversationId,
                userId: data.userId,
            });
        });

        // Handle message deletion — broadcast to room excluding sender
        socket.on('message-deleted', (data: { conversationId: string; messageId: string }) => {
            socket.to(`conversation:${data.conversationId}`).emit('message-deleted', {
                conversationId: data.conversationId,
                messageId: data.messageId,
            });
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            const userId = (socket as any).userId;
            if (userId) {
                userSocketMap.delete(userId);
                // Persist lastSeen + offline status to DB
                updateUserStatus(userId, 'offline');
                // Broadcast offline status
                io.emit('user-status-changed', { userId, status: 'offline', lastSeen: new Date().toISOString() });
                console.log(`[Socket.io] User ${userId} disconnected`);
            }
        });
    });

    res.end();
}
