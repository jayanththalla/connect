import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer;

export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: ['https://connect-ecru-mu.vercel.app', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] User connected: ${socket.id}`);

    // Join a conversation room
    socket.on('join-conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket.io] User ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave-conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`[Socket.io] User ${socket.id} left conversation ${conversationId}`);
    });

    // Handle new message
    socket.on('send-message', (data: { conversationId: string; message: any }) => {
      io.to(`conversation:${data.conversationId}`).emit('receive-message', data.message);
    });

    // Handle typing indicator
    socket.on('typing', (data: { conversationId: string; username: string }) => {
      socket.broadcast.to(`conversation:${data.conversationId}`).emit('user-typing', {
        conversationId: data.conversationId,
        username: data.username,
      });
    });

    // Handle stop typing
    socket.on('stop-typing', (data: { conversationId: string; username?: string } | string) => {
      const conversationId = typeof data === 'string' ? data : data.conversationId;
      const username = typeof data === 'string' ? '' : (data.username || '');
      socket.broadcast.to(`conversation:${conversationId}`).emit('user-stop-typing', {
        conversationId,
        username,
      });
    });

    // User status update
    socket.on('user-status', (data: { userId: string; status: 'online' | 'offline' }) => {
      io.emit('user-status-changed', data);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] User disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
