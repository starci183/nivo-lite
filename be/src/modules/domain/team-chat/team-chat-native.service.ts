import { Injectable } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    ToolsError,
    ToolsErrorCode,
    RoutedToolFamily,
    argumentsOf,
    type ToolJson,
    type ToolManifest,
    type ToolHandler,
} from "@modules/domain/tools"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { POST_REPORT_INPUT_SCHEMA, POST_REPORT_SCHEMA } from "./team-chat-native.schema"
import { TeamChatRoomsService } from "./team-chat.service"

/** The language the cards of the chat are written in: a job runs for no viewer, so the workspace default. */
const LOCALE = "vi"

/** The refusal of an expected case: an answer to the caller, never a failure of the connector. */
const noRoom = (): ToolsError =>
    new ToolsError({ code: ToolsErrorCode.NativeRefused, params: { reason: "no_room" } })

/**
 * The chat capability of the NIVO MCP door for the declared jobs of the engine: `report.post` writes the report of a finished run.
 * Internal callers only; the chat keeps one card per run.
 */
export const TEAM_CHAT_MANIFEST: ToolManifest = {
    key: "team-chat",
    namespace: "nivo.tool.team-chat",
    name: "Team chat",
    contractVersion: "team-chat-native@1",
    tools: [
        {
            name: "report.post",
            description: "Writes the report of a finished run in the room its agent reports to. One report per run.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: POST_REPORT_INPUT_SCHEMA,
            argumentSchema: POST_REPORT_SCHEMA,
            idempotencyArg: "runId",
            domain: TOOL.teamChatReportPost,
            internalOnly: true,
        },
    ],
}

@Injectable()
/** Runs the tools of the team chat connector for the declared jobs of the engine. */
export class TeamChatNativeService extends RoutedToolFamily {
    readonly manifest: ToolManifest = TEAM_CHAT_MANIFEST

    constructor(
        private readonly chat: TeamChatRoomsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {
        super()
    }

    protected readonly handlers: ReadonlyMap<string, ToolHandler> = new Map([
        ["report.post", (workspaceId, args) => this.report(workspaceId, args)],
    ])

    private async report(workspaceId: string, args: ToolJson): Promise<ToolJson> {
        const parsed = argumentsOf("report.post", POST_REPORT_SCHEMA, args)
        const body = this.catalog.get("teamChat.report", { trigger: parsed.trigger }, LOCALE)
        const posted = await this.chat.postReport(workspaceId, {
            runId: parsed.runId,
            agentId: parsed.agentId,
            body,
            roomId: null,
        })
        if (posted === null) throw noRoom()
        return { roomId: posted.roomId, messageId: posted.messageId, created: posted.created }
    }
}
