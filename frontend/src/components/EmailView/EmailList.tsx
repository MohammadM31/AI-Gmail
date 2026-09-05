// frontend/src/components/EmailView/EmailList.tsx
import { useEffect, useState, useCallback, useMemo, memo } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { useDebounce } from "../../hooks/useDebounce";
import { Skeleton, SkeletonList } from "../Shared/Skeleton";
import { toast } from "sonner";
import type { EmailItem } from "../../types";
import { listEmails } from "../../services/apiClient";
import { useUserStore } from "../../stores/userStore";

// ✅ Memoized Email Card
const EmailCard = memo(function EmailCard({
  email,
  onSelect,
  currentUserId,
}: {
  email: EmailItem;
  onSelect: (email: EmailItem) => void;
  currentUserId: string | null;
}) {
  const getInitials = (email: EmailItem) => {
    if (email.senderId === currentUserId) return "Y";
    const firstRecipient = email.recipients[0];
    if (firstRecipient) {
      return firstRecipient.name.charAt(0).toUpperCase();
    }
    return "?";
  };

  const getSenderName = (email: EmailItem) => {
    if (email.senderId === currentUserId) return "You";
    const firstRecipient = email.recipients[0];
    return firstRecipient?.name || "Unknown";
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
    <button
      onClick={() => onSelect(email)}
      className="w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-full bg-accent-light/10 dark:bg-accent-dark/40 flex items-center justify-center text-sm font-semibold shrink-0">
        {getInitials(email)}
      </div>

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
            {email.bulletPoints[0] || email.content?.substring(0, 100) || "No preview"}
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getStatusColor(email.status)}`}>
            {email.status}
          </span>
        </div>

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
  );
});

// ✅ Main EmailList Component
export const EmailList = memo(function EmailList({ onSelect }: { onSelect: (email: EmailItem) => void }) {
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "subject" | "recipient" | "status">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "subject-asc" | "subject-desc" | "status" | "recipient">("newest");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const currentUser = useUserStore((s) => s.user);

  // ✅ Debounce search query
  const debouncedQuery = useDebounce(query, 300);

  // ✅ Load function with pagination
  const load = useCallback(
    async (reset: boolean = true) => {
      if (reset) {
        setPage(1);
        setHasMore(true);
        setLoading(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();

        if (debouncedQuery && filterType !== "all") {
          params.append("q", debouncedQuery);
          params.append("filterType", filterType);
        } else if (debouncedQuery) {
          params.append("q", debouncedQuery);
        }

        if (statusFilter !== "all") {
          params.append("status", statusFilter);
        }

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

        params.append("sortBy", sortBy);
        params.append("page", String(reset ? 1 : page + 1));
        params.append("pageSize", "20");

        const response = await listEmails(params.toString());

        if (reset) {
          setEmails(response.items);
        } else {
          setEmails((prev) => [...prev, ...response.items]);
        }

        setTotal(response.total);
        setHasMore(response.items.length < response.total);
        setPage(reset ? 1 : page + 1);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load emails";
        setError(errorMessage);
        toast.error("Failed to load emails", { description: errorMessage });
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, filterType, sortBy, statusFilter, dateRange, dateFrom, dateTo, page]
  );

  // ✅ Initial load and when filters change
  useEffect(() => {
    load(true);
  }, [load]);

  // ✅ Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        load(true);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [load, loading]);

  // ✅ Load more for infinite scroll
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      load(false);
    }
  }, [loading, hasMore, load]);

  // ✅ Memoize the email list
  const emailList = useMemo(() => {
    return emails.map((email) => (
      <li key={email.id}>
        <EmailCard email={email} onSelect={onSelect} currentUserId={currentUser?.id || null} />
      </li>
    ));
  }, [emails, onSelect, currentUser]);

  // ✅ Handle date range change
  const handleDateRangeChange = (value: typeof dateRange) => {
    setDateRange(value);
    if (value !== "custom") {
      setDateFrom("");
      setDateTo("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[200px]">
          <input
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-highlight transition"
            placeholder="Search emails… (Ctrl+K to focus)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(true)}
          />
        </div>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
        >
          <option value="all">All fields</option>
          <option value="subject">Subject</option>
          <option value="recipient">Recipient</option>
          <option value="status">Status</option>
        </select>

        <select
          className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm outline-none"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
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
          onChange={(e) => handleDateRangeChange(e.target.value as typeof dateRange)}
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
          onClick={() => load(true)}
          className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 transition"
        >
          Apply
        </button>

        {/* Results count */}
        {!loading && emails.length > 0 && (
          <span className="text-xs opacity-40 ml-2">
            {emails.length} of {total}
          </span>
        )}
      </div>

      {/* Loading/Error States */}
      {loading && page === 1 && <SkeletonList count={5} />}

      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
          {error}
          <button className="underline ml-2 hover:opacity-80" onClick={() => load(true)}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && emails.length === 0 && (
        <div className="text-center py-12 text-sm opacity-60">
          {query || statusFilter !== "all" || dateRange !== "all"
            ? "No emails match your filters. Try adjusting your search."
            : "📭 No emails yet. Start composing!"}
        </div>
      )}

      {/* Infinite Scroll Email List */}
      <InfiniteScroll
        dataLength={emails.length}
        next={loadMore}
        hasMore={hasMore}
        loader={
          <div className="py-4">
            <SkeletonList count={3} />
          </div>
        }
        endMessage={
          emails.length > 0 && (
            <div className="text-center py-6 text-sm opacity-40">
              🎉 You've seen all {emails.length} emails
            </div>
          )
        }
        scrollableTarget="main-content"
      >
        <ul className="divide-y divide-black/10 dark:divide-white/10 rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden">
          {emailList}
        </ul>
      </InfiniteScroll>
    </div>
  );
});