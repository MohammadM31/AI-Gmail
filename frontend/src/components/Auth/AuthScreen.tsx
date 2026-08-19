import { useState, FormEvent } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserStore } from "../../stores/userStore";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [orgMode, setOrgMode] = useState<"create" | "join">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const { signIn, signUp, loading, error } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "login") {
      await signIn(email, password).catch(() => {});
    } else {
      await signUp({
        email,
        password,
        name,
        organizationName: orgMode === "create" ? organizationName : undefined,
        inviteCode: orgMode === "join" ? inviteCode : undefined,
      }).catch(() => {});
    }
  }

  function handleDevLogin() {
    useUserStore.getState().setSession(
      {
        id: "dev-user",
        email: "dev@example.com",
        name: "Developer",
        organizationId: "dev-org"
      },
      "dev-token"
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-light dark:bg-bg-dark px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-6 space-y-4"
      >
        <h1 className="text-lg font-semibold">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>

        {mode === "register" && (
          <>
            <input
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setOrgMode("create")}
                className={`flex-1 rounded-md py-1.5 transition ${
                  orgMode === "create"
                    ? "bg-highlight text-white"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                New organization
              </button>
              <button
                type="button"
                onClick={() => setOrgMode("join")}
                className={`flex-1 rounded-md py-1.5 transition ${
                  orgMode === "join" ? "bg-highlight text-white" : "opacity-60 hover:opacity-100"
                }`}
              >
                Join with invite code
              </button>
            </div>

            {orgMode === "create" ? (
              <input
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm outline-none"
                placeholder="Organization name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
            ) : (
              <input
                className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm outline-none"
                placeholder="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
              />
            )}
          </>
        )}

        <input
          type="email"
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm outline-none"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm outline-none"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "register" ? 8 : undefined}
        />

        {error && <p className="text-sm text-highlight">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-highlight px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition"
        >
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="w-full text-xs opacity-70 hover:opacity-100 underline"
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>

        {/* ✅ DEV MODE: Skip Login Button */}
        <button
          type="button"
          onClick={handleDevLogin}
          className="w-full rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
        >
          🚀 Skip Login (Dev Mode)
        </button>
      </form>
    </div>
  );
}