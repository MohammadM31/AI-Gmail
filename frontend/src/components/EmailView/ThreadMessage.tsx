import { EmailItem } from "../../types";

interface ThreadMessageProps {
  message: EmailItem;
  isCurrentUser: boolean;
}

export function ThreadMessage({ message, isCurrentUser }: ThreadMessageProps) {
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
            {isCurrentUser ? "You" : message.senderId}
          </span>
          <span className="text-xs opacity-60">
            {new Date(message.createdAt).toLocaleString()}
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