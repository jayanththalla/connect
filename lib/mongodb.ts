import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

if (!process.env.MONGODB_URI) {
  throw new Error('Please add MONGODB_URI to your environment variables');
}

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_NAME = 'connect_app';

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);

  await client.connect();
  const db = client.db(DATABASE_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export async function getDatabase() {
  const { db } = await connectToDatabase();
  return db;
}

// Initialize collections and indexes
export async function initializeDatabase() {
  const db = await getDatabase();

  // Users collection
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ username: 1 });

  // Conversations collection
  await db.collection('conversations').createIndex({ participants: 1 });
  await db.collection('conversations').createIndex({ createdAt: -1 });

  // Messages collection
  await db.collection('messages').createIndex({ conversationId: 1 });
  await db.collection('messages').createIndex({ senderId: 1 });
  await db.collection('messages').createIndex({ createdAt: -1 });
  await db.collection('messages').createIndex({ conversationId: 1, createdAt: -1 });
}
