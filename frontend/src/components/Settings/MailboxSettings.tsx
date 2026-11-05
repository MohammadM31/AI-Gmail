import { useEffect, useState } from "react";
import { addMailRule, getMailbox, shareMailbox, updateMailbox } from "../../services/apiClient";
import type { MailboxSettings as MailboxSettingsData } from "../../types";

export function MailboxSettings() {
  const [mailbox, setMailbox] = useState<MailboxSettingsData | null>(null);
  const [signature, setSignature] = useState("");
  const [autoFacts, setAutoFacts] = useState("");
  const [autoOn, setAutoOn] = useState(false);
  const [aliasName, setAliasName] = useState("");
  const [aliasEmail, setAliasEmail] = useState("");
  const [listName, setListName] = useState("");
  const [listEmails, setListEmails] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"read" | "send">("read");
  const [ruleFrom, setRuleFrom] = useState("");
  const [ruleFolder, setRuleFolder] = useState<"spam" | "archive" | "inbox">("spam");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMailbox()
      .then((doc) => {
        setMailbox(doc);
        setSignature(doc.signature.join("\n"));
        setAutoFacts(doc.autoReply.facts.join("\n"));
        setAutoOn(doc.autoReply.enabled);
      })
      .catch(() => setError("Mailbox settings are not available yet."));
  }, []);

  async function saveBasics() {
    const saved = await updateMailbox({
      signature: signature.split("\n").map((line) => line.trim()).filter(Boolean),
      autoReply: {
        enabled: autoOn,
        facts: autoFacts.split("\n").map((line) => line.trim()).filter(Boolean),
        until: mailbox?.autoReply.until ?? null,
      },
      aliases: mailbox?.aliases,
      lists: mailbox?.lists,
    });
    setMailbox(saved);
  }

  if (!mailbox) {
    return error ? <p className="text-xs text-highlight">{error}</p> : null;
  }

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium">Signature</h3>
        <p className="text-xs opacity-60 mb-1">One short fact per line. It is added when a message sends.</p>
        <textarea
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          className="w-full min-h-16 bg-transparent text-sm outline-none border border-black/10 dark:border-white/10 rounded-lg px-2 py-1"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={autoOn} onChange={(event) => setAutoOn(event.target.checked)} />
        Auto-reply with these facts
      </label>
      <textarea
        value={autoFacts}
        onChange={(event) => setAutoFacts(event.target.value)}
        placeholder="Away until Friday"
        className="w-full min-h-16 bg-transparent text-sm outline-none border border-black/10 dark:border-white/10 rounded-lg px-2 py-1"
      />
      <button onClick={saveBasics} className="rounded-full bg-highlight px-3 py-1 text-xs text-white">
        Save signature and auto-reply
      </button>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Send-as alias</h3>
        <div className="flex gap-2">
          <input value={aliasName} onChange={(event) => setAliasName(event.target.value)} placeholder="Name" className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
          <input value={aliasEmail} onChange={(event) => setAliasEmail(event.target.value)} placeholder="alias@domain" className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
          <button
            className="text-xs underline"
            onClick={async () => {
              if (!aliasEmail.includes("@")) return;
              const saved = await updateMailbox({
                aliases: [...mailbox.aliases, { name: aliasName || aliasEmail, email: aliasEmail }],
              });
              setMailbox(saved);
              setAliasName("");
              setAliasEmail("");
            }}
          >
            Add
          </button>
        </div>
        <p className="text-xs opacity-60">{mailbox.aliases.map((alias) => alias.email).join(", ") || "No aliases"}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Mailing list</h3>
        <div className="flex gap-2">
          <input value={listName} onChange={(event) => setListName(event.target.value)} placeholder="List name" className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
          <input value={listEmails} onChange={(event) => setListEmails(event.target.value)} placeholder="a@x.com, b@x.com" className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
          <button
            className="text-xs underline"
            onClick={async () => {
              const addresses = listEmails
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.includes("@"))
                .map((email) => ({ name: email.split("@")[0], email }));
              if (!listName.trim() || addresses.length === 0) return;
              const saved = await updateMailbox({
                lists: [...mailbox.lists, { name: listName.trim(), addresses }],
              });
              setMailbox(saved);
              setListName("");
              setListEmails("");
            }}
          >
            Add
          </button>
        </div>
        <p className="text-xs opacity-60">{mailbox.lists.map((list) => list.name).join(", ") || "No lists"}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Shared mailbox</h3>
        <div className="flex gap-2">
          <input value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} placeholder="teammate@domain" className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
          <select value={shareRole} onChange={(event) => setShareRole(event.target.value as "read" | "send")} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm">
            <option value="read">Read</option>
            <option value="send">Send</option>
          </select>
          <button
            className="text-xs underline"
            onClick={async () => {
              try {
                setMailbox(await shareMailbox(shareEmail.trim(), shareRole));
                setShareEmail("");
                setError(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not share");
              }
            }}
          >
            Share
          </button>
        </div>
        {mailbox.access.length > 0 && (
          <p className="text-xs opacity-60">
            You can open: {mailbox.access.map((item) => item.email).join(", ")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Rule</h3>
        <div className="flex gap-2">
          <input value={ruleFrom} onChange={(event) => setRuleFrom(event.target.value)} placeholder="From contains" className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm" />
          <select value={ruleFolder} onChange={(event) => setRuleFolder(event.target.value as "spam" | "archive" | "inbox")} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm">
            <option value="spam">Spam</option>
            <option value="archive">Archive</option>
            <option value="inbox">Inbox</option>
          </select>
          <button
            className="text-xs underline"
            onClick={async () => {
              if (!ruleFrom.trim()) return;
              setMailbox(await addMailRule({ from: ruleFrom.trim(), folder: ruleFolder }));
              setRuleFrom("");
            }}
          >
            Add
          </button>
        </div>
        <p className="text-xs opacity-60">
          {mailbox.rules.map((rule) => `${rule.from ?? "any"} → ${rule.folder ?? "inbox"}`).join(", ") || "No rules"}
        </p>
      </div>

      <p className="text-xs opacity-60">
        {mailbox.mailAuth.smtp
          ? "Outbound mail leaves through the configured SMTP server."
          : "SMTP is not configured, so mail stays inside the organization."}{" "}
        {mailbox.mailAuth.dkim ? "DKIM signing is on." : "DKIM signs a message when DKIM_PRIVATE_KEY, DKIM_DOMAIN, and DKIM_SELECTOR are set."}{" "}
        {mailbox.mailAuth.spf} {mailbox.mailAuth.dmarc}
      </p>
      {error && <p className="text-xs text-highlight">{error}</p>}
    </div>
  );
}
