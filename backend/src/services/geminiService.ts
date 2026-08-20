import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger";

export interface AiProcessResult {
  recipients: { name: string; email: string | null }[];
  subject: string;
  bulletPoints: string[];
  chart: {
    type: "bar" | "line" | "pie";
    title: string;
    labels: string[];
    values: number[];
  } | null;
  tone: "professional" | "casual" | "urgent";
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const PROMPT_TEMPLATE = (input: string) => `
You are an assistant that converts a rough email brief into structured data.
Return ONLY valid JSON (no markdown fences) matching exactly this shape:

{
  "recipients": [{"name": string, "email": string | null}],
  "subject": string,
  "bulletPoints": string[],   // 3 to 7 concise bullet points
  "chart": {
    "type": "bar" | "line" | "pie",
    "title": string,
    "labels": string[],
    "values": number[]
  } | null,                   // null if no numeric/trend data is present
  "tone": "professional" | "casual" | "urgent"
}

Message to process:
"""${input}"""
`;

/**
 * Calls Gemini to turn free-form text into structured email data.
 * Throws if GEMINI_API_KEY is not configured — callers should catch
 * and surface a clear error rather than silently degrading.
 */
export async function processMessageWithAI(
  input: string
): Promise<AiProcessResult> {
  if (!genAI) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the backend. Set it in backend/.env."
    );
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const result = await model.generateContent(PROMPT_TEMPLATE(input));
  const text = result.response.text().trim();

  const cleaned = text.replace(/^```json\s*|```$/g, "").trim();

  try {
    return JSON.parse(cleaned) as AiProcessResult;
  } catch (err) {
    logger.error({ err, raw: text }, "Failed to parse Gemini response as JSON");
    throw new Error("AI response was not valid JSON");
  }
}
