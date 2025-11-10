import React, { useRef, useEffect } from 'react';
import './style.scss';

const EMOJI_LIST = [
  '👍', '👎', '❤️', '😂', '😮', '😢', 
  '😡', '🎉', '🔥', '👏', '🤔', '😍',
  '🥰', '😊', '😎', '🤩', '😭', '🤗',
  '🙏', '💯', '✨', '💪', '🎊', '🌟'
];

const EmojiPicker = ({ onEmojiSelect, currentReaction, show, onClose }) => {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="emoji-picker" ref={pickerRef}>
      <div className="emoji-picker-grid">
        {EMOJI_LIST.map((emoji, index) => (
          <button
            key={index}
            className={`emoji-item ${currentReaction === emoji ? 'active' : ''}`}
            onClick={() => onEmojiSelect(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
