import { Injectable } from "@nestjs/common"
import { McpGatewayError, McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import {
    POST_APPROVAL_INPUT_SCHEMA,
    POST_APPROVAL_SCHEMA,
    POST_REPORT_INPUT_SCHEMA,
    POST_REPORT_SCHEMA,
} from "./team-chat-native.schema"
import { approvalCardOf, groupOf } from "./approval-card.policy"
import { TeamChatRoomsService } from "./team-chat.service"

/** The language the cards of the chat are written in: a job runs for no viewer, so the workspace default. */
const LOCALE = "vi"

/** The refusal of an expected case: an answer to the caller, never a failure of the connector. */
const noRoom = (): McpGatewayError =>
    new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params: { reason: "no_room" } })

/**
 * The chat capability of the NIVO MCP door for the declared jobs of the engine: `post-report` writes the report of a finished run and
 * `post-approval` the approval card of a decision. Internal callers only; the chat keeps one card per run or decision per room.
 */
export const TEAM_CHAT_MANIFEST: NativeConnectorManifest = {
    key: "team-chat",
    name: "Team chat",
    kind: "native",
    contractVersion: "team-chat-native@1",
    tools: [
        {
            name: "post-report",
            description: "Writes the report of a finished run in the room its agent reports to. One report per run.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: POST_REPORT_INPUT_SCHEMA,
            argumentSchema: POST_REPORT_SCHEMA,
            idempotencyArg: "runId",
            domain: "team-chat.post-report",
            internalOnly: true,
        },
        {
            name: "post-approval",
            description:
                "Writes the approval card of a decision in the rooms its rule names. One card per decision per room.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: POST_APPROVAL_INPUT_SCHEMA,
            argumentSchema: POST_APPROVAL_SCHEMA,
            idempotencyArg: "decisionId",
            domain: "team-chat.post-approval",
            internalOnly: true,
        },
    ],
}

@Injectable()
/** Runs the tools of the team chat connector for the declared jobs of the engine. */
export class TeamChatNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = TEAM_CHAT_MANIFEST

    constructor(
        private readonly chat: TeamChatRoomsService,
        private readonly rules: AuthorityRulesService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Runs one tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, _caller: NativeCaller): Promise<GatewayJson> {
        if (tool === "post-report") return this.report(workspaceId, args)
        if (tool === "post-approval") return this.approval(workspaceId, args)
        throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
    }

    private async report(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = POST_REPORT_SCHEMA.safeParse(args)
        if (!parsed.success)
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "post-report" } })
        const body = this.catalog.get("teamChat.report", { trigger: parsed.data.trigger }, LOCALE)
        const posted = await this.chat.postReport(workspaceId, {
            runId: parsed.data.runId,
            agentId: parsed.data.agentId,
            body,
            roomId: null,
        })
        if (posted === null) throw noRoom()
        return { roomId: posted.roomId, messageId: posted.messageId, created: posted.created }
    }

    private async approval(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = POST_APPROVAL_SCHEMA.safeParse(args)
        if (!parsed.success)
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: "post-approval" } })
        const request = await this.chat.approvalRequest(workspaceId, parsed.data.decisionId)
        if (request === null) throw noRoom()
        const group =
            groupOf(request.storedGroup) ?? (await this.rules.approvalSetup(workspaceId, request.action))?.group
        const card = approvalCardOf(request, group ?? { roles: [], rooms: [], members: [] })
        const key = card.amount === null ? "teamChat.approvalNoAmount" : "teamChat.approval"
        const body = this.catalog.get(
            key,
            { action: card.action, amount: card.amount === null ? "" : `${String(card.amount)} ${card.unit}` },
            LOCALE,
        )
        const cards = await this.chat.postApproval(workspaceId, {
            decisionId: card.decisionId,
            body,
            agentId: card.agentId,
            roomIds: card.roomIds,
            approverSeatIds: card.approverSeatIds,
        })
        return { cards }
    }
}
