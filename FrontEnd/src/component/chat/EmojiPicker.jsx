const EMOJIS = [
  "\u{1F600}",
  "\u{1F622}",
  "\u{1F621}",
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F389}",
  "\u{1F64F}",
  "\u{1F602}",
  "\u{1F60E}",
  "\u{1F525}",
];

// component nay hien thi danh sach emoji don gian
const EmojiPicker = ({ onSelect }) => {
  return (
    <div className="chat-emoji-panel">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="chat-emoji-button"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiPicker;
