// src/components/EmailView/EmailList.tsx
import { useEffect, useState, useCallback } from "react";
import type { EmailItem } from "../../types";
import { listEmails } from "../../services/apiClient";
import { useUserStore } from "../../stores/userStore";

interface EmailListProps {
  onSelect: (email: EmailItem) => void;
}

type FilterType = "all" | "subject" | "recipient" | "status";
type SortOption = "newest" | "oldest" | "subject-asc" | "subject-desc" | "status" | "recipient";

export function EmailList({ onSelect }: EmailListProps) {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useUserStore((s) => s.user);

  // Load emails with filters and sorting
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      // Search query
      if (query && filterType !== "all") {
        params.append("q", query);
        params.append("filterType", filterType);
      } else if (query) {
        params.append("q", query);
      }

      // Status filter
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      // Date range
      if (dateRange === "today") {
        const today = new Date().toISOString().split("T")[0];
        params.append("dateFrom", today);
        params.append("dateTo", today);
      } else if (dateRange === "week") {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        params.append("dateFrom", weekAgo.toISOString().split("T")[0]);
        params.append("dateTo", now.toISOString().split("T")[0]);
      } else if (dateRange === "month") {
        const now = new Date();
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        params.append("dateFrom", monthAgo.toISOString().split("T")[0]);
        params.append("dateTo", now.toISOString().split("T")[0]);
      } else if (dateRange === "custom" && dateFrom && dateTo) {
        params.append("dateFrom", dateFrom);
        params.append("dateTo", dateTo);
      }

      // Sorting
      params.append("sortBy", sortBy);

      const { items } = await listEmails(params.toString());
      setEmails(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [query, filterType, sortBy, statusFilter, dateRange, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  // Get initials for avatar
  const getInitials = (email: EmailItem) => {
    if (email.senderId === currentUser?.id) return "Y";
    const firstRecipient = email.recipients[0];
    if (firstRecipient) {
      return firstRecipient.name.charAt(0).toUpperCase();
    }
    return "?";
  };

  const getSenderName = (email: EmailItem) => {
    if (email.senderId === currentUser?.id) return "You";
    const firstRecipient = email.recipients[0];
    return firstRecipient?.name || "Unknown";
  };

  const getRecipientName = (email: EmailItem) => {
    if (email.recipients.length === 0) return "No recipients";
    return email.recipients[0]?.name || "Unknown";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "draft":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "deleted":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400";
    }
  };

  const formatTimestamp = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isYesterday = d.toDateString() === new Date(now.setDate(now.getDate() - 1)).toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (isYesterday) {
      return "Yesterday";
    } else {
      return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
            placeholder="Search emails…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
        >
          <option value="all">All fields</option>
          <option value="subject">Subject</option>
          <option value="recipient">Recipient</option>
          <option value="status">Status</option>
        </select>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="subject-asc">A-Z (Subject)</option>
          <option value="subject-desc">Z-A (Subject)</option>
          <option value="recipient">A-Z (Recipient)</option>
          <option value="status">Status</option>
        </select>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="draft">Drafts</option>
          <option value="deleted">Deleted</option>
        </select>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
        >
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>

        {dateRange === "custom" && (
          <>
            <input
              type="date"
              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </>
        )}

        <button
          onClick={load}
          className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Apply
        </button>
      </div>

      {/* Loading/Error States */}
      {loading && <p className="text-sm opacity-60">Loading…</p>}
      {error && (
        <p className="text-sm text-highlight">
          {error} <button className="underline" onClick={load}>Retry</button>
        </p>
      )}
      {!loading && !error && emails.length === 0 && (
        <p className="text-sm opacity-60">No emails found matching your filters.</p>
      )}

      {/* Email Cards */}
      <ul className="divide-y divide-black/10 dark:divide-white/10 rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden">
        {emails.map((email) => (
          <li key={email.id}>
            <button
              onClick={() => onSelect(email)}
              className="w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-start gap-3"
            >
              {/* Avatar / Initials */}
              <div className="w-10 h-10 rounded-full bg-accent-light/10 dark:bg-accent-dark/40 flex items-center justify-center text-sm font-semibold shrink-0">
                {getInitials(email)}
              </div>

              {/* Email Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">
                      {getSenderName(email)}
                    </span>
                    <span className="text-xs opacity-50 truncate">
                      {email.subject}
                    </span>
                  </div>
                  <span className="text-xs opacity-50 shrink-0" title={getFullTimestamp(email.createdAt)}>
                    {formatTimestamp(email.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs opacity-60 truncate">
                    {email.bulletPoints[0] || email.content || "No preview"}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getStatusColor(email.status)}`}>
                    {email.status}
                  </span>
                </div>

                {/* Recipients preview */}
                {email.recipients.length > 0 && (
                  <div className="flex gap-1 mt-1 text-xs opacity-40 truncate">
                    <span>To:</span>
                    {email.recipients.map((r, i) => (
                      <span key={i}>
                        {r.name}{i < email.recipients.length - 1 ? "," : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}