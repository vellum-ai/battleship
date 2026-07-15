/**
 * Init hook — creates the Battleship workspace app on plugin load.
 *
 * Since plugins cannot yet contribute apps directly (no apps/ surface in
 * the external plugin loader), the init hook programmatically creates a
 * workspace-level app by writing the manifest JSON + HTML source into
 * the workspace's data/apps/ directory.
 *
 * On subsequent loads, if the app already exists, the HTML is refreshed
 * from the plugin's bundled app/index.html so updates take effect without
 * needing to delete and recreate the app.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { InitContext } from "@vellumai/plugin-api";

/** The app directory name (slug) in data/apps/. */
const APP_DIR_NAME = "battleship";
/** The app ID is deterministic so the app_open tool can reference it. */
const APP_ID = "battleship";

export default async function init(_ctx: InitContext): Promise<void> {
  const workspaceDir =
    process.env.VELLUM_WORKSPACE_DIR ||
    join(process.env.HOME || "~", ".vellum");

  const appsDir = join(workspaceDir, "data", "apps");
  const appDir = join(appsDir, APP_DIR_NAME);
  const manifestPath = join(appsDir, `${APP_DIR_NAME}.json`);

  // Read the bundled HTML from the plugin's app/ directory
  const pluginDir = dirname(fileURLToPath(import.meta.url));
  // hooks/ is one level down from the plugin root
  const pluginRoot = join(pluginDir, "..");
  const htmlPath = join(pluginRoot, "app", "index.html");

  if (!existsSync(htmlPath)) {
    // Plugin may be installed without the app/ directory — skip silently
    return;
  }

  const htmlContent = readFileSync(htmlPath, "utf-8");

  // Ensure the app directory exists
  mkdirSync(appDir, { recursive: true });

  // Write the HTML source
  writeFileSync(join(appDir, "index.html"), htmlContent, "utf-8");

  // Check if the manifest already exists
  const manifestExists = existsSync(manifestPath);
  const now = Date.now();

  const manifest = {
    id: APP_ID,
    name: "Battleship",
    description:
      "Play Battleship against your assistant. The assistant hunts your fleet while you hunt theirs.",
    icon: "naval_jack",
    dirName: APP_DIR_NAME,
    createdAt: manifestExists
      ? readExistingCreatedAt(manifestPath)
      : now,
    updatedAt: now,
    conversationIds: [],
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  // Also ensure the plugin data directory exists for game state
  const dataDir = join(workspaceDir, "plugins", "battleship", "data");
  mkdirSync(dataDir, { recursive: true });
}

function readExistingCreatedAt(manifestPath: string): number {
  try {
    const raw = readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.createdAt ?? Date.now();
  } catch {
    return Date.now();
  }
}
