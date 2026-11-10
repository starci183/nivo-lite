import { Injectable } from "@nestjs/common"
import { McpGatewayError, McpGatewayErrorCode, RoutedNativeAdapter, argumentsOf } from "@modules/domain/mcp-gateway"
import type { GatewayJson, NativeConnectorManifest, NativeToolHandler } from "@modules/domain/mcp-gateway"
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
 * The chat capability of the NIVO MCP door for the declared jobs of the engine: `report.post` writes the report of a finished run and
 * `approval.post` the approval card of a decision. Internal callers only; the chat keeps one card per run or decision per room.
 */
export const TEAM_CHAT_MANIFEST: NativeConnectorManifest = {
    key: "team-chat",
    namespace: "nivo.team-chat",
    name: "Team chat",
    kind: "native",
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
            domain: "nivo.team-chat.report.post",
            internalOnly: true,
        },
        {
            name: "approval.post",
            description:
                "Writes the approval card of a decision in the rooms its rule names. One card per decision per room.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: POST_APPROVAL_INPUT_SCHEMA,
            argumentSchema: POST_APPROVAL_SCHEMA,
            idempotencyArg: "decisionId",
            domain: "nivo.team-chat.approval.post",
            internalOnly: true,
        },
    ],
}

@Injectable()
/** Runs the tools of the team chat connector for the declared jobs of the engine. */
export class TeamChatNativeService extends RoutedNativeAdapter {
    readonly manifest: NativeConnectorManifest = TEAM_CHAT_MANIFEST

    constructor(
        private readonly chat: TeamChatRoomsService,
        private readonly rules: AuthorityRulesService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {
        super()
    }

    protected readonly handlers: ReadonlyMap<string, NativeToolHandler> = new Map([
        ["report.post", (workspaceId, args) => this.report(workspaceId, args)],
        ["approval.post", (workspaceId, args) => this.approval(workspaceId, args)],
    ])

    private async report(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
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

    private async approval(workspaceId: string, args: GatewayJson): Promise<GatewayJson> {
        const parsed = argumentsOf("approval.post", POST_APPROVAL_SCHEMA, args)
        const request = await this.chat.approvalRequest(workspaceId, parsed.decisionId)
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
