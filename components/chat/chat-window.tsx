'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/lib/use-socket';

// ─── Emoji Data ─────────────────────────────────────────
const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: '😊 Smileys',
    emojis: ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐'],
  },
  {
    label: '👋 Gestures',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏'],
  },
  {
    label: '❤️ Hearts',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  },
  {
    label: '🎉 Objects',
    emojis: ['🎉','🎊','🎈','🎁','🎀','🏆','🥇','⭐','🌟','✨','💫','🔥','💯','❗','❓','💬','💭','🗨️','📱','💻','⌚','📷','🎵','🎶','🔔','📌','📎','✏️','📝','💡'],
  },
  {
    label: '🍕 Food',
    emojis: ['🍕','🍔','🍟','🌭','🍿','🧂','🥚','🍳','🧈','🥞','🥓','🥩','🍗','🌮','🌯','🥙','🧆','🍜','🍝','🍣','🍱','🍰','🎂','🍩','🍪','☕','🍵','🧃','🥤','🍷','🍺'],
  },
];

// ─── URL detection regex ────────────────────────────────
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

// ─── Interfaces ─────────────────────────────────────────
interface Message {
  _id: string;
  content: string;
  sender: {
    _id: string;
    username: string;
    avatar: string;
  };
  readBy?: string[];
  replyTo?: {
    _id: string;
    content: string;
    sender: { username: string };
  };
  deleted?: boolean;
  createdAt: string;
  status?: 'sending' | 'sent' | 'read';
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
  type: 'dm' | 'group';
  name?: string;
  unreadCount?: number;
}

interface ChatWindowProps {
  conversation: Conversation;
  user: any;
  onlineUsers: Set<string>;
  onBack: () => void;
  onMessagesRead: () => void;
}

// ─── Helper: Render message content with clickable links ─
function renderMessageContent(content: string, isOwn: boolean): React.ReactNode {
  if (!content) return null;
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX.source, 'g');

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline break-all ${isOwn ? 'text-blue-200 hover:text-blue-100' : 'text-blue-600 hover:text-blue-700'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {url.length > 45 ? url.substring(0, 42) + '…' : url}
      </a>
    );
    lastIndex = match.index + url.length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

// ─── Helper: Date separator label ───────────────────────
function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const current = new Date(messages[index].createdAt);
  const prev = new Date(messages[index - 1].createdAt);
  return current.toDateString() !== prev.toDateString();
}

// ─── Main Component ─────────────────────────────────────
export default function ChatWindow({ conversation, user, onlineUsers, onBack, onMessagesRead }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
  
  // Unread & Scroll Features
  const [unreadSeparatorIndex, setUnreadSeparatorIndex] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket(user?.id);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstLoad = useRef(true);
  const pageRef = useRef(1);
  const conversationIdRef = useRef(conversation._id);
  const onMessagesReadRef = useRef(onMessagesRead);

  onMessagesReadRef.current = onMessagesRead;

  // Reset on conversation change
  useEffect(() => {
    conversationIdRef.current = conversation._id;
    isFirstLoad.current = true;
    pageRef.current = 1;
    setMessages([]);
    setLoadingMessages(true);
    setHasMore(false);
    setLoadingMore(false);
    setIsTyping(null);
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setContextMenu(null);
    setUnreadSeparatorIndex(null);
    setShowScrollButton(false);
    setNewMessagesCount(0);

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com'}/api/conversations/${conversation._id}/messages?page=1&limit=50`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && conversationIdRef.current === conversation._id) {
          setMessages(data.messages);
          setHasMore(data.pagination.hasMore);
          
          // Set unread separator if there are unread messages
          if (conversation.unreadCount && conversation.unreadCount > 0) {
            const index = Math.max(0, data.messages.length - conversation.unreadCount);
            setUnreadSeparatorIndex(index);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingMessages(false));

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com'}/api/conversations/${conversation._id}/read`, { method: 'POST' })
      .then(() => onMessagesReadRef.current())
      .catch(() => {});
  }, [conversation._id]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const convId = conversation._id;
    socket.emit('join-conversation', convId);

    const handleReceiveMessage = (message: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });

      // Update scroll button badge if not at bottom
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (!isNearBottom) {
          setNewMessagesCount(prev => prev + 1);
          setShowScrollButton(true);
        }
      }

      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com'}/api/conversations/${convId}/read`, { method: 'POST' })
        .then(() => {
          onMessagesReadRef.current();
          socket.emit('mark-read', { conversationId: convId, userId: user?.id });
        })
        .catch(() => {});
    };

    const handleUserTyping = (data: { conversationId: string; username: string }) => {
      if (data.conversationId === convId) setIsTyping(data.username);
    };

    const handleUserStopTyping = (data: { conversationId: string }) => {
      if (data.conversationId === convId) setIsTyping(null);
    };

    const handleMessagesRead = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === convId) {
        setMessages((prev) =>
          prev.map((msg) => ({
            ...msg,
            readBy: msg.readBy ? [...new Set([...msg.readBy, data.userId])] : [data.userId],
          }))
        );
      }
    };

    const handleMessageDeleted = (data: { conversationId: string; messageId: string }) => {
      if (data.conversationId === convId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === data.messageId
              ? { ...msg, content: '🚫 This message was deleted', deleted: true }
              : msg
          )
        );
      }
    };

    socket.on('receive-message', handleReceiveMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stop-typing', handleUserStopTyping);
    socket.on('messages-read', handleMessagesRead);
    socket.on('message-deleted', handleMessageDeleted);

    return () => {
      socket.off('receive-message', handleReceiveMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stop-typing', handleUserStopTyping);
      socket.off('messages-read', handleMessagesRead);
      socket.off('message-deleted', handleMessageDeleted);
      socket.emit('leave-conversation', convId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversation._id]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length === 0) return;

    if (isFirstLoad.current) {
      messagesEndRef.current?.scrollIntoView();
      isFirstLoad.current = false;
      return;
    }

    const container = messagesContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Close context menu and emoji picker on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Load older messages
  const loadOlderMessages = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com'}/api/conversations/${conversationIdRef.current}/messages?page=${nextPage}&limit=50`
      );
      if (response.ok) {
        const data = await response.json();
        const container = messagesContainerRef.current;
        const prevHeight = container?.scrollHeight || 0;

        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newMsgs = data.messages.filter((m: Message) => !existingIds.has(m._id));
          return [...newMsgs, ...prev];
        });
        setHasMore(data.pagination.hasMore);
        pageRef.current = nextPage;

        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevHeight;
          }
        });
      }
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Show/hide scroll button
    const isScrollUp = container.scrollHeight - container.scrollTop - container.clientHeight > 300;
    setShowScrollButton(isScrollUp);
    if (!isScrollUp) {
      setNewMessagesCount(0);
    }

    if (container.scrollTop < 50 && hasMore && !loadingMore) {
      loadOlderMessages();
    }
  }, [hasMore, loadingMore, loadOlderMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessagesCount(0);
    setShowScrollButton(false);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Create optimistic message
    const optimisticMessage: Message = {
      _id: tempId,
      content,
      sender: {
        _id: user.id || user._id,
        username: user.username,
        avatar: user.avatar,
      },
      createdAt: new Date().toISOString(),
      status: 'sending',
      ...(replyingTo ? {
        replyTo: {
          _id: replyingTo._id,
          content: replyingTo.content.substring(0, 100),
          sender: { username: replyingTo.sender.username },
        }
      } : {})
    };

    // 🚀 Optimistic Update: Add to UI instantly
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    
    // Background API call
    try {
      const body: any = { content };
      if (optimisticMessage.replyTo) {
        body.replyTo = optimisticMessage.replyTo;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com'}/api/conversations/${conversation._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const confirmedMessage = await response.json();
        
        // Update the optimistic message with server data
        setMessages((prev) => 
          prev.map((msg) => msg._id === tempId ? { ...confirmedMessage, status: 'sent' } : msg)
        );

        if (socket) {
          socket.emit('send-message', { conversationId: conversation._id, message: confirmedMessage });
          socket.emit('stop-typing', { conversationId: conversation._id });
        }
        onMessagesReadRef.current();
      } else {
        // Handle error: mark as failed or remove
        setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (socket && e.target.value.trim()) {
      socket.emit('typing', { conversationId: conversation._id, username: user?.username });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (socket) socket.emit('stop-typing', { conversationId: conversation._id });
      }, 2000);
    } else if (socket) {
      socket.emit('stop-typing', { conversationId: conversation._id });
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com'}/api/conversations/${conversation._id}/messages/${messageId}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? { ...msg, content: '🚫 This message was deleted', deleted: true }
              : msg
          )
        );
        if (socket) {
          socket.emit('message-deleted', { conversationId: conversation._id, messageId });
        }
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
    setContextMenu(null);
  };

  // Context menu
  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    if (message.deleted) return;
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

  // Emoji insert
  const insertEmoji = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const getConversationTitle = () => {
    if (conversation.type === 'group') return conversation.name;
    const other = conversation.participants.find((p) => p._id !== user?.id);
    return other?.username || 'Unknown';
  };

  const getPresenceInfo = () => {
    if (conversation.type === 'group') {
      const onlineCount = conversation.participants.filter(
        (p) => p._id !== user?.id && onlineUsers.has(p._id)
      ).length;
      return onlineCount > 0 ? `${onlineCount} online` : '';
    }
    const other = conversation.participants.find((p) => p._id !== user?.id);
    if (!other) return '';
    if (onlineUsers.has(other._id)) return 'Online';
    if (other.lastSeen) {
      const date = new Date(other.lastSeen);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `last seen today at ${timeStr}`;
      if (isYesterday) return `last seen yesterday at ${timeStr}`;
      return `last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    }
    return 'Offline';
  };

  const isOwnMessage = (senderId: string) => senderId === user?.id;

  const getReadStatus = (msg: Message) => {
    if (!isOwnMessage(msg.sender._id)) return null;
    const otherParticipants = conversation.participants.filter((p) => p._id !== user?.id);
    const allRead = otherParticipants.every((p) => msg.readBy?.includes(p._id));
    if (allRead && otherParticipants.length > 0) return 'read';
    return 'sent';
  };

  return (
    <div className="flex flex-col h-full">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="px-4 py-3 bg-primary/10 border-b border-border flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="md:hidden p-1 hover:bg-muted rounded-lg transition-colors">
          <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative">
          {conversation.type === 'group' ? (
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-semibold">
                {conversation.participants.length}
              </span>
            </div>
          ) : (
            <>
              <img
                src={conversation.participants.find((p) => p._id !== user?.id)?.avatar}
                alt=""
                className="w-10 h-10 rounded-full"
              />
              {onlineUsers.has(
                conversation.participants.find((p) => p._id !== user?.id)?._id || ''
              ) && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
              )}
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">
            {getConversationTitle()}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isTyping ? (
              <span className="text-primary italic">typing...</span>
            ) : (
              getPresenceInfo()
            )}
          </p>
        </div>
      </div>

      {/* ─── Messages Area ───────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-1 chat-wallpaper custom-scrollbar"
      >
        {loadingMore && (
          <div className="text-center py-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-muted-foreground text-sm">No messages yet. Say hello! 👋</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const own = isOwnMessage(message.sender._id);
            const readStatus = getReadStatus(message);
            const showDate = shouldShowDateSeparator(messages, index);

            return (
              <div key={message._id}>
                {/* Date Separator */}
                {showDate && (
                  <div className="flex justify-center py-3 date-badge-animate">
                    <span className="px-4 py-1 bg-background/80 backdrop-blur-sm text-muted-foreground text-[11px] font-medium rounded-full shadow-sm border border-border/50">
                      {getDateLabel(message.createdAt)}
                    </span>
                  </div>
                )}

                {/* Unread Separator */}
                {index === unreadSeparatorIndex && (
                  <div className="flex justify-center py-4 my-2">
                    <div className="relative w-full flex justify-center items-center">
                      <div className="absolute w-full border-t border-primary/20" />
                      <span className="relative z-10 px-4 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-widest shadow-sm">
                        {conversation.unreadCount} Unread Messages
                      </span>
                    </div>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`flex items-end gap-2 ${own ? 'justify-end' : 'justify-start'} mb-1 message-animate`}
                  onContextMenu={(e) => handleContextMenu(e, message)}
                >
                  {/* Sender Avatar (Left) */}
                  {!own && (
                    <div className="flex-shrink-0 w-8 h-8 self-end mb-1">
                      {index === messages.length - 1 || messages[index + 1]?.sender._id !== message.sender._id ? (
                        <img
                          src={message.sender.avatar}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover shadow-sm border border-border/50"
                        />
                      ) : (
                        <div className="w-8" /> // Spacer for clustered messages
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[70%] sm:max-w-sm`}>
                    {!own && conversation.type === 'group' && (
                      <span className="text-[11px] text-primary font-medium ml-2 mb-0.5">
                        {message.sender.username}
                      </span>
                    )}
                    <div
                      className={`px-3 py-1.5 rounded-2xl shadow-sm cursor-pointer transition-all ${
                        own
                          ? 'bg-[var(--chat-bubble-own)] text-[var(--chat-bubble-own-foreground)] rounded-br-none'
                          : 'bg-[var(--chat-bubble-other)] text-[var(--chat-bubble-other-foreground)] rounded-bl-none'
                      } ${message.deleted ? 'opacity-60' : 'hover:brightness-95'} ${
                        message.status === 'sending' ? 'opacity-70 scale-[0.98]' : 'scale-100'
                      }`}
                      onClick={() => {
                        if (!message.deleted && message.status !== 'sending') {
                          setReplyingTo(message);
                          inputRef.current?.focus();
                        }
                      }}
                    >
                      {/* Reply Preview */}
                      {message.replyTo && (
                        <div className="reply-preview bg-black/5 dark:bg-white/5 rounded-lg px-2 py-1.5 mb-1.5 text-xs border-l-2 border-primary/40">
                          <span className="font-semibold text-primary">
                            {message.replyTo.sender.username}
                          </span>
                          <p className="truncate opacity-70">{message.replyTo.content}</p>
                        </div>
                      )}

                      <div className={`text-[13.5px] leading-relaxed break-words ${message.deleted ? 'italic' : ''}`}>
                        {message.deleted ? message.content : renderMessageContent(message.content, own)}
                      </div>

                      <div className={`flex items-center gap-1 mt-1 ${own ? 'justify-end' : ''}`}>
                        <span className={`text-[10px] ${own ? 'opacity-70' : 'text-muted-foreground'}`}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {own && !message.deleted && (
                          <span className="flex items-center">
                            {message.status === 'sending' ? (
                              <svg className="w-2.5 h-2.5 opacity-60 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" strokeWidth="2.5" />
                                <path d="M12 6v6l4 2" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                            ) : (
                              <span className={`text-[11px] ${readStatus === 'read' ? 'text-blue-400' : 'opacity-60'}`}>
                                {readStatus === 'read' ? '✓✓' : '✓'}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Self Avatar (Right) - Production Look */}
                  {own && (
                    <div className="flex-shrink-0 w-8 h-8 self-end mb-1">
                      {index === messages.length - 1 || messages[index + 1]?.sender._id !== message.sender._id ? (
                        <img
                          src={message.sender.avatar}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover shadow-sm border border-border/50"
                        />
                      ) : (
                        <div className="w-8" /> // Spacer
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start mb-1 message-animate">
            <div className="bg-[var(--chat-bubble-other)] px-4 py-2.5 rounded-lg rounded-tl-none shadow-sm">
              <div className="flex gap-1.5 items-center h-4">
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full typing-dot" />
                <div className="w-2 h-2 bg-muted-foreground/60 rounded-full typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        
        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-24 right-6 w-10 h-10 bg-background border border-border rounded-full shadow-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all z-40 animate-in fade-in zoom-in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7-7-7" />
            </svg>
            {newMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                {newMessagesCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ─── Context Menu ────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-50 context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[160px]">
            <button
              className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors flex items-center gap-2"
              onClick={() => {
                setReplyingTo(contextMenu.message);
                setContextMenu(null);
                inputRef.current?.focus();
              }}
            >
              <span>↩️</span> Reply
            </button>
            <button
              className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors flex items-center gap-2"
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.message.content);
                setContextMenu(null);
              }}
            >
              <span>📋</span> Copy
            </button>
            {isOwnMessage(contextMenu.message.sender._id) && (
              <button
                className="w-full px-4 py-2 text-sm text-left hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
                onClick={() => handleDeleteMessage(contextMenu.message._id)}
              >
                <span>🗑️</span> Delete for everyone
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Reply Preview Bar ───────────────────────────── */}
      {replyingTo && (
        <div className="px-4 py-2 border-t border-border bg-muted/50 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 reply-preview pl-3 min-w-0">
            <p className="text-xs font-semibold text-primary">{replyingTo.sender.username}</p>
            <p className="text-xs text-muted-foreground truncate">{replyingTo.content}</p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ─── Emoji Picker ────────────────────────────────── */}
      {showEmojiPicker && (
        <div className="border-t border-border bg-background p-3 flex-shrink-0 emoji-picker-animate">
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {cat.label}
                </p>
                <div className="flex flex-wrap gap-0.5">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Message Input ───────────────────────────────── */}
      <form
        onSubmit={handleSendMessage}
        className="px-3 py-2 border-t border-border flex items-center gap-2 flex-shrink-0 bg-background"
      >
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`p-2 rounded-full transition-colors flex-shrink-0 ${
            showEmojiPicker ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={handleMessageChange}
          placeholder="Type a message"
          className="flex-1 px-4 py-2 bg-muted border border-border rounded-full text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-40 transition-all flex-shrink-0 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
