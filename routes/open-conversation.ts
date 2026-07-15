/**
 * Open conversation route — navigate the client to a specific conversation.
 *
 *   POST /x/plugins/battleship/open-conversation
 *   Body: { "conversationId": "<id>" }
 *
 * Publishes an open_conversation event via the assistant event hub so
 * connected clients (web, desktop) navigate to the conversation.
 */

export const description = "Navigate client to a Battleship game conversation";

export async function POST(
  request: Request,
  context: {
    assistantEventHub: { publish(event: unknown): Promise<void> };
    assistantId: string;
  },
): Promise<Response> {
  let body: { conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.conversationId) {
    return Response.json({ error: "Missing conversationId" }, { status: 400 });
  }

  await context.assistantEventHub.publish({
    id: crypto.randomUUID(),
    assistantId: context.assistantId,
    conversationId: body.conversationId,
    emittedAt: new Date().toISOString(),
    message: {
      type: "open_conversation",
      conversationId: body.conversationId,
      focus: true,
    },
  });

  return Response.json({ ok: true });
}
