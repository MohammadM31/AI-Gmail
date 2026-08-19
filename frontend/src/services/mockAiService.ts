import type { AiProcessResult } from "../types";

/**
 * Stand-in for the real backend call while you don't have a Gemini
 * key wired up yet. Swap `processMessage` in apiClient.ts to call
 * POST /api/ai/process once the backend is live — same return shape.
 */
export async function mockProcessMessage(
  input: string
): Promise<AiProcessResult> {
  await new Promise((r) => setTimeout(r, 700)); // feel like a real call

  const hasNumbers = /\d/.test(input);

  return {
    recipients: [{ name: "Sample Recipient", email: "recipient@example.com" }],
    subject: input.slice(0, 60) || "Untitled",
    bulletPoints: [
      "Summarized key point one from your message",
      "Summarized key point two from your message",
      "Suggested next step based on the content",
    ],
    chart: hasNumbers
      ? {
          type: "bar",
          title: "Detected figures",
          labels: ["Q1", "Q2", "Q3", "Q4"],
          values: [12, 19, 8, 25],
        }
      : null,
    tone: "professional",
  };
}
