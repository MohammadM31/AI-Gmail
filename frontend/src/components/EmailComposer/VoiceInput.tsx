// frontend/src/components/EmailComposer/VoiceInput.tsx
import { useRef, useState } from "react";

interface Props {
  onTranscript: (text: string) => void;
}

export function VoiceInput({ onTranscript }: Props) {
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
      recognition.lang = "en-US";
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

  if (!supported) {
    return (
      <span className="text-xs text-ink-light/50 dark:text-ink-dark/50">
        Voice input isn't supported in this browser
      </span>
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
      {error && <span className="text-xs text-highlight">{error}</span>}
    </div>
  );
}