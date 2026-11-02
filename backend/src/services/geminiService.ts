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

const MODEL_NAME = (process.env.OPENAI_MODEL || "gpt-6-luna").trim();

function modelSupportsReasoning(model: string): boolean {
  return /^(gpt-[56]|o\d)/i.test(model);
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("")
    .trim();
}

function openAiError(status: number, body: string): Error {
  let detail = body.slice(0, 300);
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) detail = parsed.error.message;
  } catch {
    // The body was not JSON; keep the truncated text.
  }
  detail = detail.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
  return new Error(`OpenAI request failed (${status}): ${detail}`);
}

function namesReferToSamePerson(contact: string, recipient: string): boolean {
  const left = contact.trim().toLowerCase();
  const right = recipient.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;
  const leftParts = left.split(/\s+/);
  const rightParts = right.split(/\s+/);
  return leftParts[0] === rightParts[0];
}

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

async function completeJson(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured on the backend. Set it in the Render environment."
    );
  }

  const body: Record<string, unknown> = {
    model: MODEL_NAME,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return only valid JSON." },
      { role: "user", content: prompt },
    ],
  };
  if (modelSupportsReasoning(MODEL_NAME)) {
    body.reasoning_effort = "none";
    body.max_completion_tokens = 2000;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw openAiError(response.status, await response.text());
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: unknown; refusal?: string | null } }[];
  };
  const message = data.choices?.[0]?.message;
  const text = messageText(message?.content);
  if (!text) {
    throw new Error(message?.refusal || "OpenAI returned an empty response");
  }
  return text;
}

export async function processMessageWithAI(
  input: string,
  contacts: string[] = []
): Promise<AiProcessResult> {
  const text = await completeJson(buildPrompt(input, contacts, input.length));
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
      parsed.recipients = parsed.recipients.filter((recipient) => {
        const email = recipient.email?.trim();
        if (email && email.includes("@")) return true;
        return contacts.some((contact) => namesReferToSamePerson(contact, recipient.name));
      });
    }

    return parsed;
  } catch (err) {
    logger.error(
      {
        err,
        raw: text,
      },
      "Failed to parse OpenAI response as JSON"
    );

    throw new Error("AI response was not valid JSON");
  }
}

/**
 * Generic structured AI helper.
 *
 * Callers keep their own JSON shape. This only sends the prompt and parses
 * the object the model returns.
 */
export async function generateStructuredAI<T>(prompt: string): Promise<T> {
  const text = await completeJson(`
Return ONLY valid JSON.

Do not wrap the response in Markdown.
Do not include explanations before or after the JSON.

${prompt}
`);
  const cleaned = cleanJsonResponse(text);

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.error(
      {
        err,
        raw: text,
      },
      "Failed to parse structured OpenAI response"
    );

    throw new Error("AI response was not valid JSON");
  }
}
