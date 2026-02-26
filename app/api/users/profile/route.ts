import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { verifyToken } from '@/lib/auth-middleware';
import { connectToDatabase } from '@/lib/mongodb';

// PUT — Update user profile (username, bio)
export async function PUT(request: NextRequest) {
    try {
        const decoded = verifyToken(request);
        if (!decoded) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { username, bio } = body;

        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        const updateFields: any = { updatedAt: new Date() };

        // Validate and update username if provided
        if (username !== undefined) {
            const trimmedUsername = username.trim();
            if (!trimmedUsername || trimmedUsername.length < 3) {
                return NextResponse.json(
                    { error: 'Username must be at least 3 characters' },
                    { status: 400 }
                );
            }

            if (trimmedUsername.length > 30) {
                return NextResponse.json(
                    { error: 'Username must be at most 30 characters' },
                    { status: 400 }
                );
            }

            // Check uniqueness (skip if unchanged)
            const existingUser = await usersCollection.findOne({
                _id: { $ne: new ObjectId(decoded.userId) },
                username: { $regex: `^${trimmedUsername}$`, $options: 'i' },
            });

            if (existingUser) {
                return NextResponse.json(
                    { error: 'Username is already taken' },
                    { status: 409 }
                );
            }

            updateFields.username = trimmedUsername;
            // Update DiceBear avatar to match new username
            updateFields.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${trimmedUsername}`;
        }

        // Update bio if provided
        if (bio !== undefined) {
            updateFields.bio = bio.trim().substring(0, 150);
        }

        await usersCollection.updateOne(
            { _id: new ObjectId(decoded.userId) },
            { $set: updateFields }
        );

        // Return updated user data
        const updatedUser = await usersCollection.findOne(
            { _id: new ObjectId(decoded.userId) },
            { projection: { password: 0 } }
        );

        if (!updatedUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: updatedUser._id.toString(),
            email: updatedUser.email,
            username: updatedUser.username,
            avatar: updatedUser.avatar,
            bio: updatedUser.bio || '',
            status: updatedUser.status || 'offline',
            lastSeen: updatedUser.lastSeen,
        });
    } catch (error) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
