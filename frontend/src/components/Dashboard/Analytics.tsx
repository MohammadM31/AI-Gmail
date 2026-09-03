// frontend/src/components/Dashboard/Analytics.tsx
import { useEffect, useState } from "react";
import { UsageStats } from "./UsageStats";
import { getTopics, getTopicTrends, listContacts, exportAnalytics } from "../../services/apiClient";
import type { Contact } from "../../types";

export function Analytics() {
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [exporting, setExporting] = useState(false);

  const [selectedContactId, setSelectedContactId] = useState("");
  const [dateRange, setDateRange] = useState<"7days" | "30days" | "90days" | "custom">("30days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [limit, setLimit] = useState(5);

  useEffect(() => {
    loadContacts();
    loadTopics();
  }, []);

  async function loadContacts() {
    try {
      const data = await listContacts();
      setContacts(data);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    }
  }

  async function loadTopics() {
    setLoading(true);
    setError(null);
    try {
      let start: string | undefined;
      let end: string | undefined;

      if (dateRange === "custom" && startDate && endDate) {
        start = startDate;
        end = endDate;
      } else if (dateRange !== "custom") {
        const now = new Date();
        const days = parseInt(dateRange);
        const from = new Date(now);
        from.setDate(now.getDate() - days);
        start = from.toISOString().split("T")[0];
        end = now.toISOString().split("T")[0];
      }

      const data = await getTopics({
        contactId: selectedContactId || undefined,
        startDate: start,
        endDate: end,
        limit,
      });

      setTopics(data.topics);
      setTotalEmails(data.totalEmails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load topics");
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      let start: string | undefined;
      let end: string | undefined;

      if (dateRange === "custom" && startDate && endDate) {
        start = startDate;
        end = endDate;
      } else if (dateRange !== "custom") {
        const now = new Date();
        const days = parseInt(dateRange);
        const from = new Date(now);
        from.setDate(now.getDate() - days);
        start = from.toISOString().split("T")[0];
        end = now.toISOString().split("T")[0];
      }

      await exportAnalytics({ startDate: start, endDate: end });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export analytics");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
        <h3 className="text-sm font-medium mb-3">Filters</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs opacity-60 block mb-1">Contact</label>
            <select
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
              value={selectedContactId}
              onChange={(e) => setSelectedContactId(e.target.value)}
            >
              <option value="">All Contacts</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-xs opacity-60 block mb-1">Date Range</label>
            <select
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            >
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 90 days</option>
              <option value="custom">Custom range</option>
            </select>
          </div>

          {dateRange === "custom" && (
            <>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs opacity-60 block mb-1">From</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs opacity-60 block mb-1">To</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex-1 min-w-[100px]">
            <label className="text-xs opacity-60 block mb-1">Topics</label>
            <select
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
          </div>

          <button
            onClick={loadTopics}
            className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Apply
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-full border border-black/10 dark:border-white/10 px-4 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "📥 Export CSV"}
          </button>
        </div>
      </div>

      <UsageStats
        dateFrom={dateRange !== "custom" ? undefined : startDate}
        dateTo={dateRange !== "custom" ? undefined : endDate}
      />

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Frequent topics</h3>
          <span className="text-xs opacity-40">{totalEmails} emails analyzed</span>
        </div>

        {loading && <p className="text-sm opacity-60">Loading…</p>}
        {error && (
          <p className="text-sm text-highlight">
            {error} <button className="underline" onClick={loadTopics}>Retry</button>
          </p>
        )}
        {!loading && !error && topics.length === 0 && (
          <p className="text-sm opacity-60">Send a few emails and topics will show up here.</p>
        )}

        <div className="space-y-3">
          {topics.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-medium w-6 text-right opacity-50">{i + 1}</span>
              <span className="text-sm flex-1">{item.topic}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-highlight rounded-full"
                    style={{ width: `${(item.count / Math.max(...topics.map(t => t.count), 1)) * 100}%` }}
                  />
                </div>
                <span className="text-xs opacity-40 w-8 text-right">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}