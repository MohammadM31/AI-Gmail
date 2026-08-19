import { useEffect, useState } from "react";
import { useUserStore } from "../../stores/userStore";
import * as api from "../../services/apiClient";
import type { UserSettingsData } from "../../types";

export function Settings() {
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);

  const [settings, setSettings] = useState<UserSettingsData | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings);
    setLoadingInvite(true);
    api
      .getInviteCode()
      .then((res) => {
        setInviteCode(res.inviteCode);
        setOrgName(res.organizationName);
      })
      .finally(() => setLoadingInvite(false));
  }, []);

  async function handleChange<K extends keyof UserSettingsData>(key: K, value: UserSettingsData[K]) {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSavingSettings(true);
    try {
      await api.updateSettings({ [key]: value });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleRegenerateInvite() {
    setLoadingInvite(true);
    try {
      const res = await api.regenerateInviteCode();
      setInviteCode(res.inviteCode);
    } finally {
      setLoadingInvite(false);
    }
  }

  function handleCopyInvite() {
    if (!inviteCode) return;
    navigator.clipboard?.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-6 max-w-md">
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4">
        <h3 className="text-sm font-medium mb-2">Profile</h3>
        <p className="text-sm opacity-70">{user?.name}</p>
        <p className="text-xs opacity-50">{user?.email}</p>
        <button
          onClick={logout}
          className="mt-3 text-xs underline opacity-70 hover:opacity-100"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 space-y-3">
        <h3 className="text-sm font-medium">Defaults</h3>
        <label className="block text-xs opacity-70">
          AI tone
          <select
            className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm"
            value={settings?.aiTone ?? "professional"}
            onChange={(e) => handleChange("aiTone", e.target.value as UserSettingsData["aiTone"])}
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="block text-xs opacity-70">
          Default chart type
          <select
            className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm"
            value={settings?.defaultChartType ?? "bar"}
            onChange={(e) =>
              handleChange("defaultChartType", e.target.value as UserSettingsData["defaultChartType"])
            }
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </label>
        <p className="text-xs opacity-50">{savingSettings ? "Saving…" : "Saved automatically."}</p>
      </div>

      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-4 space-y-2">
        <h3 className="text-sm font-medium">{orgName ?? "Organization"} invite code</h3>
        <p className="text-xs opacity-60">
          Share this code so a teammate can join your organization at signup.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm tracking-wider">
            {loadingInvite ? "…" : inviteCode ?? "—"}
          </code>
          <button
            onClick={handleCopyInvite}
            disabled={!inviteCode}
            className="rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          onClick={handleRegenerateInvite}
          disabled={loadingInvite}
          className="text-xs underline opacity-70 hover:opacity-100"
        >
          Generate new code
        </button>
      </div>
    </div>
  );
}
