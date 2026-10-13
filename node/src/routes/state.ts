import type { FastifyInstance } from "fastify";
import { advanceSessionState } from "../sessionCache.js";

export default async function stateRoutes(app: FastifyInstance) {
  app.patch("/api/state/next", async (request, reply) => {
    const sessionIdHeader = request.headers.sessionid;
    const sessionId = Array.isArray(sessionIdHeader)
      ? sessionIdHeader[0]
      : sessionIdHeader;

    if (!sessionId) {
      return reply.code(400).send({
        error: "sessionId header is required",
      });
    }

    const result = advanceSessionState(sessionId);

    if (!result.ok) {
      return reply.code(result.status).send({
        error: result.error,
      });
    }

    return {
      sessionId,
      previousState: result.previousState,
      currentState: result.currentState,
    };
  });
}
