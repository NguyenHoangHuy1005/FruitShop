import React, { useState, useRef, useEffect } from 'react';
import { MdClose } from 'react-icons/md';
import './style.scss';

const EMOJI_LIST = [
  '👍', '👎', '❤️', '😂', '😮', '😢', 
  '😡', '🎉', '🔥', '👏', '🤔', '😍',
  '🥰', '😊', '😎', '🤩', '😭', '🤗',
  '🙏', '💯', '✨', '💪', '🎊', '🌟'
];

const ReactionModal = ({ show, onClose, onSubmit, currentReaction }) => {
  const [selectedEmoji, setSelectedEmoji] = useState(currentReaction?.icon || '👍');
  const [comment, setComment] = useState(currentReaction?.comment || '');
  const modalRef = useRef(null);

  useEffect(() => {
    if (show && currentReaction) {
      setSelectedEmoji(currentReaction.icon || '👍');
      setComment(currentReaction.comment || '');
    } else if (show) {
      setSelectedEmoji('👍');
      setComment('');
    }
  }, [show, currentReaction]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [show, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ icon: selectedEmoji, comment: comment.trim() });
    onClose();
  };

  if (!show) return null;

  return (
    <div className="reaction-modal-overlay">
      <div className="reaction-modal" ref={modalRef}>
        <div className="modal-header">
          <h3>Thêm Phản Hồi Với Cảm Xúc</h3>
          <button className="btn-close" onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="emoji-grid">
            {EMOJI_LIST.map((emoji, index) => (
              <button
                key={index}
                type="button"
                className={`emoji-option ${selectedEmoji === emoji ? 'selected' : ''}`}
                onClick={() => setSelectedEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="comment-section">
            <label>Nhận xét của bạn (tùy chọn):</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Chia sẻ suy nghĩ của bạn..."
              maxLength={200}
              rows={3}
            />
            <div className="char-count">{comment.length}/200</div>
          </div>

          <div className="preview-section">
            <div className="preview-label">Xem trước:</div>
            <div className="preview-content">
              <span className="preview-emoji">{selectedEmoji}</span>
              <span className="preview-text">{comment || '(Không có nhận xét)'}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-submit">
              {currentReaction ? 'Cập Nhật' : 'Gửi Phản Hồi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReactionModal;
