// frontend/src/components/Pipeline/PipelineComments.tsx
import React, { useState, useEffect } from "react"; // ✅ ADDED React
import { supabase } from "../../services/supabaseClient";
import { useUserStore } from "../../stores/userStore";

interface PipelineComment {
  id: string;
  pipelineId: string;
  userId: string;
  content: string;
  createdAt: string;
  userEmail?: string;
  userName?: string;
}

interface PipelineCommentsProps {
  pipelineId: string;
}

export function PipelineComments({ pipelineId }: PipelineCommentsProps) {
  const [comments, setComments] = useState<PipelineComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUser = useUserStore((s) => s.user);

  useEffect(() => {
    loadComments();
  }, [pipelineId]);

  async function loadComments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("PipelineComments")
        .select(`
          *,
          User:userId (id, email, name)
        `)
        .eq("pipelineId", pipelineId)
        .order("createdAt", { ascending: false });

      if (error) throw error;

      setComments(data.map((c: any) => ({
        ...c,
        userEmail: c.User?.email,
        userName: c.User?.name,
      })));
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }

  async function addComment() {
    if (!newComment.trim() || !currentUser) return;

    setSubmitting(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("PipelineComments")
        .insert({
          pipelineId,
          userId: currentUser.id,
          content: newComment.trim(),
          createdAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setComments(prev => [{
        ...data,
        userEmail: currentUser.email,
        userName: currentUser.name,
      }, ...prev]);
      setNewComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(id: string) {
    if (!confirm("Delete this comment?")) return;

    try {
      const { error } = await supabase
        .from("PipelineComments")
        .delete()
        .eq("id", id)
        .eq("userId", currentUser?.id);

      if (error) throw error;

      setComments(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete comment");
    }
  }

  const formatTimestamp = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // ✅ Fixed onKeyDown type
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addComment();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">💬 Comments ({comments.length})</h4>
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-16 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-16 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
        </div>
      )}

      {!loading && comments.length === 0 && (
        <div className="text-sm opacity-40 text-center py-4">
          No comments yet. Start the conversation!
        </div>
      )}

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="text-sm p-3 rounded-lg bg-black/5 dark:bg-white/5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-xs">
                  {c.userName || c.userEmail || 'Unknown'}
                </span>
                <span className="text-xs opacity-40">
                  {formatTimestamp(c.createdAt)}
                </span>
              </div>
              {c.userId === currentUser?.id && (
                <button
                  onClick={() => deleteComment(c.id)}
                  className="text-xs opacity-30 hover:opacity-100 hover:text-red-500"
                >
                  ×
                </button>
              )}
            </div>
            <p className="text-sm mt-0.5">{c.content}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting}
        />
        <button
          onClick={addComment}
          disabled={submitting || !newComment.trim()}
          className="rounded-full bg-highlight px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? "Sending..." : "Post"}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-500">{error}</div>
      )}
    </div>
  );
}