'use client';

import { useState, useEffect, useCallback } from 'react';

interface User {
  _id: string;
  username: string;
  email: string;
  avatar: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (group: any) => void;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  onCreateGroup,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Reset form state when modal is closed
  const handleClose = useCallback(() => {
    setGroupName('');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUsers([]);
    onClose();
  }, [onClose]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const handleSearch = async (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/users/search?q=${encodeURIComponent(value)}`);
      if (response.ok) {
        const data = await response.json();
        const filteredData = data.filter(
          (user: User) => !selectedUsers.some((u) => u._id === user._id)
        );
        setSearchResults(filteredData);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUsers([...selectedUsers, user]);
    setSearchResults(
      searchResults.filter((u) => u._id !== user._id)
    );
    setSearchQuery('');
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      alert('Please enter a group name and select at least one participant');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/conversations/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          participantIds: selectedUsers.map((u) => u._id),
        }),
      });

      if (response.ok) {
        const group = await response.json();
        onCreateGroup(group);
        setGroupName('');
        setSelectedUsers([]);
        onClose();
      }
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isCreateDisabled = loading || !groupName.trim() || selectedUsers.length === 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        // Close on backdrop click (only when clicking the overlay itself)
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-xl font-semibold text-foreground">Create Group Chat</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="My Awesome Group"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Members ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <div
                    key={user._id}
                    className="bg-primary text-white text-sm px-3 py-1 rounded-full flex items-center gap-2"
                  >
                    {user.username}
                    <button
                      onClick={() => handleRemoveUser(user._id)}
                      className="hover:opacity-70"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Users */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Add Members
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {(searchQuery || searchResults.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-lg shadow-lg z-10">
                  {searching ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {searchQuery ? 'No users found' : 'Start typing to search'}
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user._id}
                          onClick={() => handleSelectUser(user)}
                          className="w-full px-4 py-3 text-left hover:bg-muted border-b border-border last:border-b-0 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatar}
                              alt={user.username}
                              className="w-8 h-8 rounded-full"
                            />
                            <div>
                              <p className="font-medium text-sm text-foreground">
                                {user.username}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer - Actions */}
        <div className="p-6 pt-4 border-t border-border">
          {isCreateDisabled && (
            <p className="text-xs text-muted-foreground mb-3 text-center">
              Enter a group name and select at least one member to create
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={isCreateDisabled}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
