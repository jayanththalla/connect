'use client';

import { useState } from 'react';

interface Message {
  _id: string;
  content: string;
  sender: { _id: string; username: string; };
  createdAt: string;
}

interface Participant {
  _id: string;
  username: string;
  avatar: string;
  status?: string;
  lastSeen?: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage?: Message | null;
  type: 'dm' | 'group';
  name?: string;
  updatedAt: string;
  unreadCount?: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onlineUsers: Set<string>;
  currentUserId: string;
}

export default function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  onlineUsers,
  currentUserId,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const getDisplayName = (conv: Conversation) => {
    if (conv.type === 'group') return conv.name || 'Group Chat';
    const other = conv.participants.find((p) => p._id !== currentUserId);
    return other?.username || 'Unknown';
  };

  const getAvatar = (conv: Conversation) => {
    if (conv.type === 'group') return null;
    return conv.participants.find((p) => p._id !== currentUserId)?.avatar;
  };

  const isOnline = (conv: Conversation) => {
    if (conv.type === 'group') return false;
    const other = conv.participants.find((p) => p._id !== currentUserId);
    return other ? onlineUsers.has(other._id) : false;
  };

  const getLastMessagePreview = (conv: Conversation) => {
    if (!conv.lastMessage) return 'No messages yet';
    const msg = conv.lastMessage;
    const content = typeof msg === 'string' ? msg : msg.content;
    if (!content) return 'No messages yet';

    // For group chats, prefix with sender name
    let prefix = '';
    if (conv.type === 'group' && typeof msg !== 'string' && msg.sender) {
      const isSelf = msg.sender._id === currentUserId;
      prefix = isSelf ? 'You: ' : `${msg.sender.username}: `;
    }

    const displayContent = content.length > 35 ? content.substring(0, 35) + '…' : content;
    return prefix + displayContent;
  };

  const getTimestamp = (conv: Conversation) => {
    const date = new Date(conv.updatedAt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getLastMessageStatus = (conv: Conversation) => {
    if (!conv.lastMessage || typeof conv.lastMessage === 'string') return null;
    const msg = conv.lastMessage;
    if (msg.sender?._id !== currentUserId) return null;
    // Show checkmarks for own messages
    return 'sent';
  };

  const filteredConversations = conversations.filter((conv) => {
    const name = getDisplayName(conv);
    return (name || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-muted border-none rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {conversations.length === 0 ? 'No conversations yet' : 'No matches found'}
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const hasUnread = (conversation.unreadCount ?? 0) > 0;
            const isSelected = selectedConversation?._id === conversation._id;
            const msgStatus = getLastMessageStatus(conversation);

            return (
              <button
                key={conversation._id}
                onClick={() => onSelectConversation(conversation)}
                className={`w-full px-4 py-3 text-left transition-colors conversation-item ${
                  isSelected
                    ? 'bg-primary/10'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {conversation.type === 'group' ? (
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    ) : (
                      <>
                        <img
                          src={getAvatar(conversation) || ''}
                          alt=""
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        {isOnline(conversation) && (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-background rounded-full" />
                        )}
                      </>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`font-medium text-sm truncate ${hasUnread ? 'text-foreground' : 'text-foreground'}`}>
                        {getDisplayName(conversation)}
                      </span>
                      <span className={`text-[11px] flex-shrink-0 ml-2 ${
                        hasUnread ? 'text-primary font-medium' : 'text-muted-foreground'
                      }`}>
                        {getTimestamp(conversation)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs truncate flex items-center gap-1 ${
                        hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}>
                        {msgStatus && (
                          <span className="text-muted-foreground text-[10px] flex-shrink-0">✓✓</span>
                        )}
                        {getLastMessagePreview(conversation)}
                      </span>
                      {hasUnread && (
                        <span className="ml-2 flex-shrink-0 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
