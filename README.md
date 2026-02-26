# "Connect" - Global Real-time Messaging App

"Connect" is a robust, full-stack messaging application designed to provide a seamless, WhatsApp-like communication experience. Built with a modern technical stack, it handles real-time messaging, complex presence states, and global scalability with ease.

## 🚀 Objective
The goal of this project is to implement a high-performance messaging system that addresses:
- Secure, JWT-based user authentication.
- Real-time communication using Socket.io.
- Efficient data persistence with MongoDB.
- Complex messaging states like "typing" indicators and "read receipts."
- Responsive and premium UI/UX design.

---

## 🛠️ Technical Stack
- **Frontend**: Next.js (React), Tailwind CSS, Lucide React, Shadcn UI
- **Backend**: Node.js, Express (via Next.js API Routes)
- **Database**: MongoDB (Native MongoDB Driver)
- **Real-time Engine**: Socket.io
- **Authentication**: JWT (JSON Web Tokens) with Bcrypt for password hashing

---

## ✨ Key Features

### 1. Authentication & User Profile
- **Secure Login**: JWT-based authentication system with protected API routes.
- **Profile Setup**: Users can customize their display name, set an "About" status (bio), and automatically generate avatars via DiceBear based on their username.
- **User Discovery**: Global search functionality to find and start chats with any registered user.

### 2. Real-time Messaging (1-on-1)
- **Instant Delivery**: Messages appear on the recipient's screen instantly without page refreshes, powered by Socket.io rooms.
- **Optimistic Updates**: UI updates immediately when sending a message for a lag-free experience.
- **Persistence**: Full chat history is stored in MongoDB and loaded chronologically.

### 3. Advanced Chat Features ("The WhatsApp Experience")
- **Presence Indicators**: Visual indicators for "Online" status and "Last Seen" timestamps.
- **Typing Status**: Real-time "User is typing..." indicators that trigger as you type.
- **Read Receipts**: Message status tracking with "Checkmarks" (✓ for sent, ✓✓ for read).
- **Reply System**: Contextual replies to specific messages.
- **Message Deletion**: "Delete for everyone" functionality that updates in real-time.

### 4. UI/UX Excellence
- **Responsive Design**: A premium interface featuring a sidebar for conversations and a main chat window, fully optimized for mobile devices.
- **Auto-Scroll & Unread Tracking**: Automatically scrolls to new messages; includes a "Jump to Bottom" button with an unread message badge if you're scrolled up.
- **Rich Media Support**: Clickable links with automated URL detection and emoji picker integration.
- **Clean Timestamps**: Every message shows precisely when it was sent.

---

## 📈 Technical Challenges Solved
- **Scalability**: Implemented **cursor-based pagination** for message loading (50 messages per page) and **Infinite Scrolling** to handle thousands of messages without performance degradation.
- **Latency**: Socket server is optimized to broadcast messages only to specific participant rooms, minimizing server load and network traffic.
- **Security**: 
    - Full HTML sanitization for all message content to prevent XSS attacks.
    - Protected API endpoints using custom middleware.
    - Password hashing using high-cost Bcrypt.

---

## 📥 Setup & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB connection URI

### Installation
1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```

### Seeding Test Users
Run the following script to create test accounts:
```bash
node scripts/seed.js
```

---

## 🔑 Test Credentials
Use the following accounts to test real-time messaging across two different devices or browser sessions:

| User | Email | Password |
|------|-------|----------|
| **Alice** | `alice@example.com` | `password123` |
| **Bob** | `bob@example.com` | `password123` |

---

## 📝 Deployment
- **Frontend**: Best deployed on **Vercel**.
- **Backend/Socket**: Can be hosted on **Render** or **Railway** (requires a Node.js environment that supports WebSockets).

---

Developed with ❤️ for global real-time connectivity.
