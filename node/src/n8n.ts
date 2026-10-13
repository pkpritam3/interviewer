export const ASK_WEBHOOK_URL =
  "http://localhost:5678/webhook-test/49cbba68-c402-41ce-8f27-397addbf1bc7";

export function parseAgentPayload(payload: unknown): {
  reply: string;
  status?: string;
} {
  let current: unknown = payload;

  for (let i = 0; i < 5; i++) {
    if (typeof current === "string") {
      const trimmed = current.trim();

      if (trimmed.startsWith("{")) {
        try {
          current = JSON.parse(trimmed);
          continue;
        } catch {
          return { reply: trimmed };
        }
      }

      return { reply: trimmed };
    }

    if (!current || typeof current !== "object" || Array.isArray(current)) {
      break;
    }

    const record = current as Record<string, unknown>;

    if (typeof record.reply === "string") {
      const nestedReply = record.reply.trim();

      if (nestedReply.startsWith("{")) {
        try {
          current = JSON.parse(nestedReply);
          continue;
        } catch {
          // fall through and treat as spoken text
        }
      }

      return {
        reply: nestedReply,
        status:
          typeof record.status === "string"
            ? record.status.toUpperCase()
            : undefined,
      };
    }

    if (record.reply && typeof record.reply === "object") {
      current = record.reply;
      continue;
    }

    if (record.parameters && typeof record.parameters === "object") {
      current = record.parameters;
      continue;
    }

    if ("output" in record) {
      current = record.output;
      continue;
    }

    break;
  }

  return { reply: "" };
}

export async function callAskWebhook(input: {
  query: string;
  code: string;
  problem: string;
  state: string;
  sessionId: string;
}) {
  const webhookResponse = await fetch(ASK_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      sessionId: input.sessionId,
    },
    body: JSON.stringify({
      query: input.query,
      code: input.code,
      problem: input.problem,
      state: input.state,
    }),
  });

  const contentType = webhookResponse.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await webhookResponse.json()
    : await webhookResponse.text();

  return {
    ok: webhookResponse.ok,
    status: webhookResponse.status,
    payload,
    agent: parseAgentPayload(payload),
  };
}
