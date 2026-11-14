import type { EnvSource } from "@modules/platform/config"
import type { ToolsOptions } from "./tools.options"

/** What the environment alone decides: the options without the tool family classes, which the app root adds. */
export type ToolsConfig = Omit<ToolsOptions, "natives">

/** Reads the tools settings: the time limit of one call a family's manifest does not declare (`TOOLS_TIMEOUT_MS`, 4 s). */
export const parseToolsConfig = (env: EnvSource): ToolsConfig => ({
    defaultTimeoutMs: env.int("TOOLS_TIMEOUT_MS", 4000),
})
