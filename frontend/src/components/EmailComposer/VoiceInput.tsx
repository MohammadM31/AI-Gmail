// frontend/src/components/EmailComposer/VoiceInput.tsx
import { useRef, useState } from "react";

export const VOICE_LANGUAGES = [
  { code: "en-US", label: "English" },
  { code: "ar-SA", label: "العربية" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "de-DE", label: "Deutsch" },
  { code: "pt-BR", label: "Português" },
  { code: "it-IT", label: "Italiano" },
  { code: "tr-TR", label: "Türkçe" },
  { code: "ru-RU", label: "Русский" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "zh-CN", label: "中文" },
  { code: "ja-JP", label: "日本語" },
] as const;

interface Props {
  onTranscript: (text: string) => void;
  /** Starting speech language tag. Defaults to en-US. */
  initialLanguage?: string;
  /** Called when the sender picks another language. */
  onLanguageChange?: (language: string) => void;
}

export function VoiceInput({ onTranscript, initialLanguage = "en-US", onLanguageChange }: Props) {
  const [language, setLanguage] = useState(initialLanguage);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function start() {
    if (!supported) {
      setError("Speech recognition is not supported in this browser");
      return;
    }

    setError(null);
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    
    try {
      const recognition: SpeechRecognition = new SpeechRecognitionCtor();
      recognition.lang = language;
      recognition.interimResults = true;
      // ❌ REMOVED: recognition.continuous = false; - not standard property
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join(" ");
        if (transcript.trim()) {
          onTranscript(transcript);
        }
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event);
        if (event.error === "not-allowed") {
          setError("Microphone access denied. Please grant permission.");
        } else if (event.error === "no-speech") {
          setError("No speech detected. Please try again.");
        } else {
          setError(`Speech recognition error: ${event.error}`);
        }
        setRecording(false);
      };
      
      recognition.onend = () => {
        setRecording(false);
      };
      
      recognition.start();
      recognitionRef.current = recognition;
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start speech recognition");
      setRecording(false);
    }
  }

  function stop() {
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      // Ignore
    }
    setRecording(false);
  }

  const languageSelect = (
    <select
      aria-label="Voice language"
      className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-xs"
      value={language}
      disabled={recording}
      onChange={(e) => {
        setLanguage(e.target.value);
        onLanguageChange?.(e.target.value);
      }}
    >
      {VOICE_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );

  if (!supported) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-light/50 dark:text-ink-dark/50">
          Voice input isn't supported in this browser
        </span>
        {languageSelect}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={recording ? stop : start}
        className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
          recording
            ? "bg-highlight text-white animate-pulse"
            : "bg-accent-light/10 dark:bg-accent-dark/40 hover:opacity-80"
        }`}
      >
        {recording ? "● Recording…" : "🎙 Record"}
      </button>
      {languageSelect}
      {error && <span className="text-xs text-highlight">{error}</span>}
    </div>
  );
}
