import { useNavigate } from "react-router-dom";

interface RichCaptionProps {
  text: string;
  className?: string;
  hashtagClass?: string;
  mentionClass?: string;
}

const RichCaption = ({
  text,
  className = "text-sm text-foreground/90 leading-relaxed font-medium",
  hashtagClass = "text-primary font-bold cursor-pointer hover:underline",
  mentionClass = "text-accent font-bold cursor-pointer hover:underline",
}: RichCaptionProps) => {
  const navigate = useNavigate();

  // Split text into parts: hashtags, mentions, and plain text
  const parts = text.split(/(#\w+|@\w+)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return (
            <span
              key={i}
              className={hashtagClass}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/hashtag/${part.slice(1)}`);
              }}
            >
              {part}
            </span>
          );
        }
        if (part.startsWith("@")) {
          return (
            <span
              key={i}
              className={mentionClass}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/user/${part.slice(1)}`);
              }}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default RichCaption;
