import React, { useState } from 'react';
import './style.scss';

const ReactionBar = ({ reactions = [], currentUserId, onDeleteReaction, isAdmin }) => {
  const [expandedReactions, setExpandedReactions] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState(null);

  if (!reactions || reactions.length === 0) return null;

  // Group reactions by icon
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const icon = reaction.icon;
    if (!acc[icon]) {
      acc[icon] = {
        icon,
        count: 0,
        items: [],
        hasCurrentUser: false
      };
    }
    acc[icon].count++;
    acc[icon].items.push(reaction);
    if (reaction.user._id === currentUserId || reaction.user === currentUserId) {
      acc[icon].hasCurrentUser = true;
    }
    return acc;
  }, {});

  const reactionGroups = Object.values(groupedReactions);

  // Reactions có comment
  const reactionsWithComments = reactions.filter(r => r.comment && r.comment.trim());

  return (
    <div className="reaction-bar">
      <div className="reaction-summary">
        {reactionGroups.map((group, index) => {
          // Tìm reaction của current user trong group này
          const currentUserReaction = group.items.find(
            item => item.user._id === currentUserId || item.user === currentUserId
          );
          const canDeleteOwn = currentUserReaction && onDeleteReaction;
          const showGroupDetails = expandedGroup === group.icon;
          
          return (
            <div key={index} className="reaction-group-wrapper">
              <div 
                className={`reaction-group ${group.hasCurrentUser ? 'has-current-user' : ''}`}
                title={`${group.count} người đã phản ứng`}
                onClick={() => {
                  if (isAdmin && group.count > 1) {
                    setExpandedGroup(showGroupDetails ? null : group.icon);
                  }
                }}
              >
                <span className="reaction-icon">{group.icon}</span>
                <span className="reaction-count">{group.count}</span>
                {canDeleteOwn && (
                  <button 
                    className="btn-delete-reaction-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteReaction(currentUserReaction.user?._id || currentUserReaction.user);
                    }}
                    title="Xóa reaction của bạn"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Admin popup để xem tất cả reactions trong group */}
              {showGroupDetails && isAdmin && (
                <div className="reaction-group-details">
                  <div className="details-header">
                    <span>{group.icon} {group.items.length} reactions</span>
                    <button onClick={() => setExpandedGroup(null)}>✕</button>
                  </div>
                  <div className="details-list">
                    {group.items.map((item, idx) => {
                      const isOwner = item.user._id === currentUserId || item.user === currentUserId;
                      return (
                        <div key={idx} className="detail-item">
                          <span className="detail-user">{item.user?.username || 'Người dùng'}</span>
                          {item.comment && <span className="detail-comment">"{item.comment}"</span>}
                          <button
                            className="btn-delete-detail"
                            onClick={() => {
                              onDeleteReaction(item.user?._id || item.user);
                              if (group.items.length === 1) {
                                setExpandedGroup(null);
                              }
                            }}
                            title={isOwner ? "Xóa của bạn" : "Xóa (Admin)"}
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {reactionsWithComments.length > 0 && (
        <div className="reaction-comments-section">
          <button 
            className="toggle-comments"
            onClick={() => setExpandedReactions(!expandedReactions)}
          >
            {expandedReactions ? '▼' : '▶'} {reactionsWithComments.length} phản hồi với nhận xét
          </button>

          {expandedReactions && (
            <div className="reaction-comments-list">
              {reactionsWithComments.map((reaction, index) => {
                const isOwner = reaction.user?._id === currentUserId || reaction.user === currentUserId;
                const canDelete = isOwner || isAdmin;
                
                return (
                  <div key={index} className="reaction-comment-item">
                    <div className="reaction-comment-header">
                      <span className="reaction-emoji">{reaction.icon}</span>
                      <span className="reaction-user">
                        {reaction.user?.username || 'Người dùng'}
                      </span>
                      <span className="reaction-date">
                        {new Date(reaction.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                      {canDelete && onDeleteReaction && (
                        <button 
                          className="btn-delete-reaction"
                          onClick={() => onDeleteReaction(reaction.user?._id || reaction.user)}
                          title="Xóa reaction"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="reaction-comment-text">
                      {reaction.comment}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReactionBar;
