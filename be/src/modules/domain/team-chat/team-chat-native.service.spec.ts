import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { TeamChatNativeService, TEAM_CHAT_MANIFEST } from "./team-chat-native.service"
import { TeamChatRoomsService } from "./team-chat.service"

const WS = "11111111-1111-4111-8111-111111111111"
const RUN = "22222222-2222-4222-8222-222222222222"
const AGENT = "33333333-3333-4333-8333-333333333333"
const ROOM = "44444444-4444-4444-8444-444444444444"
const SEAT = "55555555-5555-4555-8555-555555555555"
const DECISION = "66666666-6666-4666-8666-666666666666"
const CALLER = { agentId: AGENT, conversationId: null }

const build = async () => {
    const chat = mock<TeamChatRoomsService>()
    const rules = mock<AuthorityRulesService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatNativeService,
            { provide: TeamChatRoomsService, useValue: chat },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatNativeService), chat, rules, catalog }
}

const REQUEST = {
    id: DECISION,
    action: "refund",
    amount: 200000,
    unit: "vnd",
    requestedByAgentId: AGENT,
    storedGroup: null,
}

describe("TeamChatNativeService", () => {
    it("announces the two tools as internal and write", () => {
        expect(TEAM_CHAT_MANIFEST.tools.map((tool) => [tool.name, tool.internalOnly, tool.scope])).toEqual([
            ["post-report", true, "write"],
            ["post-approval", true, "write"],
        ])
    })

    it("posts the report of a run with the words of the catalog and answers where it went", async () => {
        const { service, chat } = await build()
        chat.postReport.mockResolvedValue({ roomId: ROOM, messageId: "m1", created: true })
        await expect(
            service.invoke(WS, "post-report", { runId: RUN, agentId: AGENT, trigger: "tag" }, CALLER),
        ).resolves.toEqual({ roomId: ROOM, messageId: "m1", created: true })
        expect(chat.postReport).toHaveBeenCalledWith(WS, {
            runId: RUN,
            agentId: AGENT,
            body: 'teamChat.report:{"trigger":"tag"}',
            roomId: null,
        })
    })

    it("refuses a report that has no room, a bad argument and a tool it does not have", async () => {
        const { service, chat } = await build()
        chat.postReport.mockResolvedValue(null)
        await expect(
            service.invoke(WS, "post-report", { runId: RUN, agentId: AGENT, trigger: "tag" }, CALLER),
        ).rejects.toMatchObject({ code: "MCP_GATEWAY_NATIVE_REFUSED" })
        await expect(service.invoke(WS, "post-report", { runId: "x" }, CALLER)).rejects.toMatchObject({
            code: "MCP_GATEWAY_INVALID_ARGUMENTS",
        })
        await expect(service.invoke(WS, "post-approval", {}, CALLER)).rejects.toMatchObject({
            code: "MCP_GATEWAY_INVALID_ARGUMENTS",
        })
        await expect(service.invoke(WS, "other", {}, CALLER)).rejects.toMatchObject({
            code: "MCP_GATEWAY_UNKNOWN_TOOL",
        })
    })
})

describe("TeamChatNativeService approval cards", () => {
    it("posts the card of a request to the rooms and seats of the group it stored", async () => {
        const { service, chat } = await build()
        chat.approvalRequest.mockResolvedValue({
            ...REQUEST,
            storedGroup: { roles: ["owner"], rooms: [ROOM], members: [SEAT] },
        })
        chat.postApproval.mockResolvedValue(2)
        await expect(service.invoke(WS, "post-approval", { decisionId: DECISION }, CALLER)).resolves.toEqual({
            cards: 2,
        })
        expect(chat.postApproval).toHaveBeenCalledWith(WS, {
            decisionId: DECISION,
            body: 'teamChat.approval:{"action":"refund","amount":"200000 vnd"}',
            agentId: AGENT,
            roomIds: [ROOM],
            approverSeatIds: [SEAT],
        })
    })

    it("takes the group of the rule when the request stored none, and words an action with no amount", async () => {
        const { service, chat, rules } = await build()
        chat.approvalRequest.mockResolvedValue({ ...REQUEST, amount: null })
        rules.approvalSetup.mockResolvedValue(
            mock<ApprovalSetup>({ group: { roles: ["owner"], rooms: [ROOM], members: [] } }),
        )
        chat.postApproval.mockResolvedValue(1)
        await service.invoke(WS, "post-approval", { decisionId: DECISION }, CALLER)
        expect(chat.postApproval).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({
                body: 'teamChat.approvalNoAmount:{"action":"refund","amount":""}',
                roomIds: [ROOM],
            }),
        )
        rules.approvalSetup.mockResolvedValue(null)
        await service.invoke(WS, "post-approval", { decisionId: DECISION }, CALLER)
        expect(chat.postApproval).toHaveBeenLastCalledWith(
            WS,
            expect.objectContaining({ roomIds: [], approverSeatIds: [] }),
        )
    })

    it("refuses the card of a request the workspace does not have", async () => {
        const { service, chat } = await build()
        chat.approvalRequest.mockResolvedValue(null)
        await expect(service.invoke(WS, "post-approval", { decisionId: DECISION }, CALLER)).rejects.toMatchObject({
            code: "MCP_GATEWAY_NATIVE_REFUSED",
        })
    })
})
