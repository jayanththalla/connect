'use client';

import { useState } from 'react';
import { authFetch } from '@/lib/client-auth';

interface User {
  _id: string;
  username: string;
  email: string;
  avatar: string;
}

interface SearchUsersProps {
  onSelectUser: (conversation: any) => void;
}

export default function SearchUsers({ onSelectUser }: SearchUsersProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com'}/api/users/search?q=${encodeURIComponent(value)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user: User) => {
    try {
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://connect-1mcn.onrender.com'}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: user._id,
          type: 'dm',
        }),
      });

      if (response.ok) {
        const conversation = await response.json();
        onSelectUser(conversation);
        setQuery('');
        setResults([]);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email..."
          autoFocus
          className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all"
        />
      </div>

      {(query || results.length > 0) && (
        <div className="relative mt-3 bg-background border border-border rounded-xl shadow-sm z-10 overflow-hidden">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-5 text-center">
              <svg className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-muted-foreground text-sm">
                {query ? 'No users found' : 'Type a name or email to find people'}
              </p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                {results.length} {results.length === 1 ? 'user' : 'users'} found
              </div>
              {results.map((user) => (
                <button
                  key={user._id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full px-4 py-2.5 text-left hover:bg-primary/5 border-b border-border/50 last:border-b-0 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-border group-hover:ring-primary/30 transition-all"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {user.username}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <span className="text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      Chat →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
