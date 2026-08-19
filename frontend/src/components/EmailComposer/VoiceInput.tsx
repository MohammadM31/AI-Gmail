import { useRef, useState } from "react";

interface Props {
  onTranscript: (text: string) => void;
}

// Uses the browser's SpeechRecognition API where available.
export function VoiceInput({ onTranscript }: Props) {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  function start() {
    if (!supported) return;
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const recognition: SpeechRecognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ");
      onTranscript(text);
    };
    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  }

  function stop() {
    recognitionRef.current?.stop();
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
    <button
      type="button"
      onClick={recording ? stop : start}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        recording
          ? "bg-highlight text-white"
          : "bg-accent-light/10 dark:bg-accent-dark/40 hover:opacity-80"
      }`}
    >
      {recording ? "● Recording…" : "🎙 Record"}
    </button>
  );
}
