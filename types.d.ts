/**
 * Ambient type declarations for external plugin development.
 *
 * When installed as a plugin, the assistant's runtime provides @vellumai/plugin-api
 * via a workspace-level shim. These declarations let tsc resolve the imports
 * during development without the full dependency tree installed.
 */

declare module "@vellumai/plugin-api" {
  export interface InitContext {
    config: Record<string, unknown>;
    logger: {
      info(msg: string, meta?: Record<string, unknown>): void;
      warn(msg: string, meta?: Record<string, unknown>): void;
      error(msg: string, meta?: Record<string, unknown>): void;
    };
    pluginStorageDir: string;
    assistantVersion: string;
  }

  export interface ShutdownContext {
    reason: string;
  }

  export interface ToolDefinition {
    name: string;
    description: string;
    category?: string;
    defaultRiskLevel?: string;
    executionTarget?: string;
    input_schema: Record<string, unknown>;
    execute(input: Record<string, unknown>): Promise<{
      content: string;
      isError?: boolean;
    }>;
  }
}

declare namespace NodeJS {
  interface ProcessEnv {
    VELLUM_WORKSPACE_DIR?: string;
    HOME?: string;
  }
}
