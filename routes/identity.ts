/**
 * Identity route — returns the assistant's display name.
 *
 *   GET /x/plugins/battleship/identity
 *
 * The app's fetch proxy only allows /v1/x/ paths, so the daemon's
 * /v1/identity endpoint (which requires settings.read scope) is
 * unreachable. This route exposes just the name via getAssistantName()
 * from the plugin API, which reads IDENTITY.md directly.
 */

import { getAssistantName } from "@vellumai/plugin-api";

export const description = "Get the assistant's display name";

export function GET(): Response {
  const name = getAssistantName();
  return Response.json({ name: name ?? "Assistant" });
}
