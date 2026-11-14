import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { ReadWorkspaceThemeHandler } from "./application/read-workspace-theme.handler"
import { ReadWorkspaceThemeQuery } from "./application/read-workspace-theme.query"
import { ResetWorkspaceThemeCommand } from "./application/reset-workspace-theme.command"
import { ResetWorkspaceThemeHandler } from "./application/reset-workspace-theme.handler"
import { UpdateWorkspaceThemeCommand } from "./application/update-workspace-theme.command"
import { UpdateWorkspaceThemeHandler } from "./application/update-workspace-theme.handler"

/** The workspace theme ops of the outbound MCP surface: the message each op sends to the theme handlers, with those handlers. */
export const WORKSPACE_THEME_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [ReadWorkspaceThemeHandler, UpdateWorkspaceThemeHandler, ResetWorkspaceThemeHandler],
    queries: {
        [NIVO_API.theme.get]: ReadWorkspaceThemeQuery,
    },
    commands: {
        [NIVO_API.theme.update]: UpdateWorkspaceThemeCommand,
        [NIVO_API.theme.reset]: ResetWorkspaceThemeCommand,
    },
}
