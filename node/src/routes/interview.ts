import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { callAskWebhook } from "../n8n.js";
import { loadQuestions } from "../questions.js";
import { setSessionState } from "../sessionCache.js";

export default async function interviewRoutes(app: FastifyInstance) {
  app.post("/api/interview", async (request, reply) => {
    const sessionId = randomUUID();
    setSessionState(sessionId, "INTRO");
    const questions = loadQuestions().filter((item) => item.id === "DSA002");

    if (questions.length === 0) {
      return reply.code(404).send({ error: "No interview questions found" });
    }

    try {
      const webhook = await callAskWebhook({
        query: "Start the interview.",
        code: "",
        problem: questions[0].problem,
        state: "INTRO",
        sessionId,
      });

      if (!webhook.ok) {
        return reply.code(502).send({
          error: "Webhook request failed",
          status: webhook.status,
          payload: webhook.payload,
        });
      }

      return {
        reply: webhook.agent.reply,
        sessionId,
        questions,
        state: "INTRO",
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({ error: "Could not reach webhook" });
    }
  });
}
