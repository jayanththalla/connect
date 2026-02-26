import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  email: string;
  username: string;
  password: string;
  avatar?: string;
  bio?: string;
  status?: 'online' | 'offline';
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  _id?: ObjectId;
  type: 'dm' | 'group';
  name?: string;
  participants: ObjectId[];
  creator?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  _id?: ObjectId;
  conversationId: ObjectId;
  sender: {
    _id: ObjectId;
    username: string;
    avatar: string;
  };
  content: string;
  readBy: string[];
  createdAt: Date;
}

export interface ChatSession {
  _id?: ObjectId;
  userId: string;
  socketId: string;
  conversationId?: string;
  lastActive: Date;
}
