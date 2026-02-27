'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ConversationList from '@/components/chat/conversation-list';
import ChatWindow from '@/components/chat/chat-window';
import SearchUsers from '@/components/chat/search-users';
import CreateGroupModal from '@/components/chat/create-group-modal';
import ProfileSettingsModal from '@/components/chat/profile-settings-modal';
import { useSocket } from '@/lib/use-socket';
import { authFetch, clearToken } from '@/lib/client-auth';

interface UserData {
  id: string;
  username: string;
  email: string;
  avatar: string;
  bio?: string;
  status?: string;
}

interface Participant {
  _id: string;
  username: string;
  email?: string;
  avatar: string;
  status?: string;
  lastSeen?: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage?: any;
  type: 'dm' | 'group';
  name?: string;
  updatedAt: string;
  unreadCount?: number;
}

// Simple notification sound (short beep generated as data URI)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not supported, silently fail
  }
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const selectedConversationRef = useRef<string | null>(null);

  const { socket } = useSocket(user?.id);

  // Keep ref in sync with selected conversation
  useEffect(() => {
    selectedConversationRef.current = selectedConversation?._id || null;
  }, [selectedConversation]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com';
        const response = await authFetch(`${apiUrl}/api/auth/me`);
        if (!response.ok) {
          router.push('/login');
          return;
        }
        const userData = await response.json();
        setUser(userData);
      } catch {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const loadConversations = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com';
      const response = await authFetch(`${apiUrl}/api/conversations`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  // Load conversations once user is authenticated
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Browser tab badge — show total unread in title
  useEffect(() => {
    const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount ?? 0), 0);
    document.title = totalUnread > 0 ? `(${totalUnread}) Connect` : 'Connect';
  }, [conversations]);

  // Listen for real-time events
  useEffect(() => {
    if (!socket) return;

    const handleStatusChanged = (data: { userId: string; status: string; lastSeen?: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.status === 'online') {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });

      // Update lastSeen in conversations when a user goes offline
      if (data.status === 'offline' && data.lastSeen) {
        setConversations((prev) =>
          prev.map((conv) => ({
            ...conv,
            participants: conv.participants.map((p) =>
              p._id === data.userId ? { ...p, lastSeen: data.lastSeen, status: 'offline' } : p
            ),
          }))
        );
        // Also update selectedConversation if it includes this user
        setSelectedConversation((prev) => {
          if (!prev) return prev;
          const hasUser = prev.participants.some((p) => p._id === data.userId);
          if (!hasUser) return prev;
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              p._id === data.userId ? { ...p, lastSeen: data.lastSeen, status: 'offline' } : p
            ),
          };
        });
      }
    };

    // Debounce sidebar reload to prevent cascading API calls
    let reloadTimeout: NodeJS.Timeout;
    const debouncedReload = () => {
      clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => {
        loadConversations();
      }, 500);
    };

    // Handle incoming message — play sound if not in that conversation
    const handleIncomingMessage = (message: any) => {
      // Play notification sound for messages that arrive in conversations we're not viewing
      if (message?.conversationId && message.conversationId !== selectedConversationRef.current) {
        playNotificationSound();
      }
      debouncedReload();
    };

    socket.on('user-status-changed', handleStatusChanged);
    socket.on('receive-message', handleIncomingMessage);

    return () => {
      clearTimeout(reloadTimeout);
      socket.off('user-status-changed', handleStatusChanged);
      socket.off('receive-message', handleIncomingMessage);
    };
  }, [socket, loadConversations]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowSearch(false);
    setMobileShowChat(true);
  };

  const handleNewConversation = (newConversation: Conversation) => {
    setSelectedConversation(newConversation);
    loadConversations();
    setShowSearch(false);
    setMobileShowChat(true);
  };

  const handleCreateGroup = (newGroup: Conversation) => {
    setSelectedConversation(newGroup);
    loadConversations();
    setShowCreateGroup(false);
    setMobileShowChat(true);
  };

  const handleBackToList = () => {
    setMobileShowChat(false);
  };

  const handleProfileUpdated = (updatedUser: UserData) => {
    setUser(updatedUser);
    loadConversations(); // Refresh to show updated names
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — hidden on mobile when chat is open */}
      <div
        className={`w-full md:w-80 border-r border-border flex flex-col flex-shrink-0 ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-foreground">Connect</h1>
            <div className="flex gap-1.5">
              {/* New Chat — person+ icon, clearly labeled */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showSearch
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted hover:bg-primary/10 text-muted-foreground hover:text-foreground'
                }`}
                title="Find a user and start a new chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 8v3m0 0v3m0-3h3m-3 0h-3" />
                </svg>
                <span className="hidden sm:inline">New Chat</span>
              </button>

              {/* New Group — group+ icon */}
              <button
                onClick={() => setShowCreateGroup(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-all"
                title="Create a group chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Group</span>
              </button>
            </div>
          </div>

          {/* Find User Panel — slides in with clear heading */}
          {showSearch && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                  Find a user to chat with
                </p>
                <button
                  onClick={() => setShowSearch(false)}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                  title="Close"
                >
                  <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <SearchUsers onSelectUser={handleNewConversation} />
            </div>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto mt-2">
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            onlineUsers={onlineUsers}
            currentUserId={user.id}
            hideSearch={showSearch}
          />
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-border select-none flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.username}
                className="w-10 h-10 rounded-full"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.bio || user.email}</p>
            </div>
            <button
              onClick={() => setShowProfileSettings(true)}
              className="p-2 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
              title="Profile settings"
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={async () => {
                try {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com';
                  await authFetch(`${apiUrl}/api/auth/logout`, { method: 'POST' });
                } catch {}
                clearToken();
                router.push('/login');
              }}
              className="p-2 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
              title="Log out"
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area — full width on mobile when selected */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          mobileShowChat ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            user={user}
            onlineUsers={onlineUsers}
            onBack={handleBackToList}
            onMessagesRead={() => loadConversations()}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Select a conversation</h2>
              <p className="text-muted-foreground">Choose a chat or search for a user to get started</p>
            </div>
          </div>
        )}
      </div>

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreateGroup={handleCreateGroup}
      />

      {showProfileSettings && (
        <ProfileSettingsModal
          isOpen={showProfileSettings}
          onClose={() => setShowProfileSettings(false)}
          user={user}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
}
