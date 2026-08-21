import { EmailItem } from "../../types";

interface ThreadMessageProps {
  message: EmailItem;
  isCurrentUser: boolean;
  senderName: string;
}

export function ThreadMessage({ message, isCurrentUser, senderName }: ThreadMessageProps) {
  const getFullTimestamp = (date: string) => {
    return new Date(date).toLocaleString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTimestamp = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }
  };

  return (
    <div className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isCurrentUser
            ? "bg-highlight text-white"
            : "bg-surface-light dark:bg-surface-dark border border-black/10 dark:border-white/10"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">
            {senderName}
          </span>
          <span className="text-xs opacity-60" title={getFullTimestamp(message.createdAt)}>
            {formatTimestamp(message.createdAt)}
          </span>
        </div>
        <p className="text-sm">{message.content}</p>
        {message.bulletPoints.length > 0 && (
          <ul className="mt-2 text-sm space-y-1">
            {message.bulletPoints.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span className="opacity-50">•</span>
                {point}
              </li>
            ))}
          </ul>
        )}
        {message.chartData && (
          <div className="mt-2 text-xs opacity-60">📊 Chart included</div>
        )}
      </div>
    </div>
  );
}