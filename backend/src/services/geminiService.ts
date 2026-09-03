// backend/src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger";

export interface AiProcessResult {
  recipients: { name: string; email: string | null }[];
  subject: string;
  bulletPoints: string[];
  chart: {
    type: string;
    title: string;
    labels: string[];
    values: number[];
  } | null;
  tone: "professional" | "casual" | "urgent";
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// ✅ Use environment variable for model
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function buildPrompt(input: string, contacts: string[], contentLength: number): string {
  let bulletGuidance: string;
  if (contentLength > 300) {
    bulletGuidance = "8 to 12 concise bullet points covering all key information";
  } else if (contentLength > 150) {
    bulletGuidance = "5 to 8 concise bullet points covering the main points";
  } else {
    bulletGuidance = "2 to 4 concise bullet points summarizing the key message";
  }

  const contactList = contacts.length > 0 
    ? `The user has the following contacts: ${contacts.join(', ')}.` 
    : 'The user has no contacts saved yet.';

  return `
You are an assistant that converts a rough email brief into structured data.

${contactList}
CRITICAL: Only extract recipient names that exactly match or closely match names in this contact list. If a name in the text doesn't match any contact, DO NOT include it in the recipients array. If no valid recipients are found, return an empty recipients array.

Return ONLY valid JSON (no markdown fences) matching exactly this shape:

{
  "recipients": [{"name": string, "email": string | null}],
  "subject": string,
  "bulletPoints": string[],
  "chart": {
    "type": "bar" | "line" | "pie" | "doughnut" | "radar" | "polarArea" | "scatter" | "bubble",
    "title": string,
    "labels": string[],
    "values": number[]
  } | null,
  "tone": "professional" | "casual" | "urgent"
}

Message to process:
"""${input}"""
`;
}

export async function processMessageWithAI(
  input: string,
  contacts: string[] = []
): Promise<AiProcessResult> {
  if (!genAI) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the backend. Set it in backend/.env."
    );
  }

  const contentLength = input.length;
  const prompt = buildPrompt(input, contacts, contentLength);

  const model = genAI.getGenerativeModel({ model: MODEL_NAME }); // ✅ Fixed
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const cleaned = text.replace(/^```json\s*|```$/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as AiProcessResult;
    
    if (contacts.length > 0 && parsed.recipients.length > 0) {
      const validRecipients = parsed.recipients.filter((r) =>
        contacts.some((c) => c.toLowerCase() === r.name.toLowerCase())
      );
      if (validRecipients.length === 0) {
        parsed.recipients = [];
      } else {
        parsed.recipients = validRecipients;
      }
    }
    
    return parsed;
  } catch (err) {
    logger.error({ err, raw: text }, "Failed to parse Gemini response as JSON");
    throw new Error("AI response was not valid JSON");
  }
}