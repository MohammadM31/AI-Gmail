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

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function cleanJsonResponse(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildPrompt(
  input: string,
  contacts: string[],
  contentLength: number
): string {
  let bulletGuidance: string;

  if (contentLength > 300) {
    bulletGuidance =
      "8 to 12 concise bullet points covering all key information";
  } else if (contentLength > 150) {
    bulletGuidance =
      "5 to 8 concise bullet points covering the main points";
  } else {
    bulletGuidance =
      "2 to 4 concise bullet points summarizing the key message";
  }

  const contactList =
    contacts.length > 0
      ? `The user has the following contacts: ${contacts.join(", ")}.`
      : "The user has no contacts saved yet.";

  return `
You are an assistant that converts a rough email brief into structured data.

${contactList}

Return ONLY valid JSON.

The bulletPoints field should contain ${bulletGuidance}.

Expected JSON:

{
  "recipients": [
    {
      "name": "string",
      "email": "string or null"
    }
  ],
  "subject": "string",
  "bulletPoints": ["string"],
  "chart": {
    "type": "bar | line | pie | doughnut | radar | polarArea | scatter | bubble",
    "title": "string",
    "labels": ["string"],
    "values": [0]
  },
  "tone": "professional | casual | urgent"
}

Message:

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

  const prompt = buildPrompt(input, contacts, input.length);

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
  });

  const result = await model.generateContent(prompt);

  const text = result.response.text().trim();
  const cleaned = cleanJsonResponse(text);

  try {
    const parsed = JSON.parse(cleaned) as AiProcessResult;

    if (!Array.isArray(parsed.recipients)) {
      parsed.recipients = [];
    }

    if (!Array.isArray(parsed.bulletPoints)) {
      parsed.bulletPoints = [];
    }

    if (contacts.length > 0 && parsed.recipients.length > 0) {
      parsed.recipients = parsed.recipients.filter((recipient) =>
        contacts.some(
          (contact) =>
            contact.toLowerCase() === recipient.name.toLowerCase()
        )
      );
    }

    return parsed;
  } catch (err) {
    logger.error(
      {
        err,
        raw: text,
      },
      "Failed to parse Gemini response as JSON"
    );

    throw new Error("AI response was not valid JSON");
  }
}

/**
 * Generic structured AI helper.
 *
 * This is used by the requirements system because requirements
 * analysis needs a different JSON structure than email generation.
 */
export async function generateStructuredAI<T>(
  prompt: string
): Promise<T> {
  if (!genAI) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the backend. Set it in backend/.env."
    );
  }

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
  });

  const result = await model.generateContent(`
You are a software requirements analysis assistant.

Return ONLY valid JSON.

Do not wrap the response in Markdown.
Do not include explanations before or after the JSON.

${prompt}
`);

  const text = result.response.text().trim();
  const cleaned = cleanJsonResponse(text);

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.error(
      {
        err,
        raw: text,
      },
      "Failed to parse structured Gemini response"
    );

    throw new Error("AI response was not valid JSON");
  }
}
