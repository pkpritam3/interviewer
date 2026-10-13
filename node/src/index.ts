import cors from "@fastify/cors";
import Fastify from "fastify";
import { callAskWebhook } from "./n8n.js";
import { loadQuestions } from "./questions.js";
import interviewRoutes from "./routes/interview.js";
import stateRoutes from "./routes/state.js";
import { advanceSessionState, getSessionState } from "./sessionCache.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: "http://localhost:5173",
  allowedHeaders: ["Content-Type", "sessionId"],
});

await app.register(interviewRoutes);
await app.register(stateRoutes);

app.get("/health", async () => ({ ok: true }));

app.get("/api/hello", async () => ({
  message: "Hello from Fastify",
}));

app.get<{ Params: { id: string } }>("/api/questions/:id", async (request, reply) => {
  const question = loadQuestions().find((item) => item.id === request.params.id);

  if (!question) {
    return reply.code(404).send({ error: "Question not found" });
  }

  return question;
});

app.post<{ Body: { query?: string; code?: string; problem?: string } }>(
  "/api/ask",
  async (request, reply) => {
    const { query, code, problem } = request.body ?? {};
    const sessionIdHeader = request.headers.sessionid;
    const sessionId = Array.isArray(sessionIdHeader)
      ? sessionIdHeader[0]
      : sessionIdHeader;

    if (
      typeof query !== "string" ||
      typeof code !== "string" ||
      typeof problem !== "string"
    ) {
      return reply.code(400).send({
        error: "Body must include query, code, and problem as strings",
      });
    }

    if (!sessionId) {
      return reply.code(400).send({
        error: "sessionId header is required",
      });
    }

    const state = getSessionState(sessionId);

    if (!state) {
      return reply.code(404).send({ error: "Session not found" });
    }

    try {
      const webhook = await callAskWebhook({
        query,
        code,
        problem,
        state,
        sessionId,
      });

      if (!webhook.ok) {
        return reply.code(502).send({
          error: "Webhook request failed",
          status: webhook.status,
          payload: webhook.payload,
        });
      }

      if (webhook.agent.status === "COMPLETED") {
        advanceSessionState(sessionId);
      }

      return { reply: webhook.agent.reply };
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Could not reach webhook" });
    }
  },
);

const port = Number(process.env.PORT) || 3000;

await app.listen({ port, host: "0.0.0.0" });
