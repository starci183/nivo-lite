import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { withReplayKey } from "@modules/domain/tools/idempotency-key.policy"
import { POST_REPORT_SCHEMA } from "./team-chat-native.schema"
import { TeamChatNativeService, TEAM_CHAT_MANIFEST } from "./team-chat-native.service"
import { TeamChatRoomsService } from "./team-chat.service"

const WS = "11111111-1111-4111-8111-111111111111"
const RUN = "22222222-2222-4222-8222-222222222222"
const AGENT = "33333333-3333-4333-8333-333333333333"
const ROOM = "44444444-4444-4444-8444-444444444444"
const CALLER = { agentId: AGENT, conversationId: null }

const build = async () => {
    const chat = mock<TeamChatRoomsService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatNativeService,
            { provide: TeamChatRoomsService, useValue: chat },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(TeamChatNativeService), chat, catalog }
}

describe("TeamChatNativeService", () => {
    it("announces its one tool as internal and write", () => {
        expect(TEAM_CHAT_MANIFEST.tools.map((tool) => [tool.name, tool.internalOnly, tool.scope])).toEqual([
            ["report.post", true, "write"],
        ])
    })

    it("posts the report of a run with the words of the catalog and answers where it went", async () => {
        const { service, chat } = await build()
        chat.postReport.mockResolvedValue({ roomId: ROOM, messageId: "m1", created: true })
        await expect(
            service.invoke(WS, "report.post", { runId: RUN, agentId: AGENT, trigger: "tag" }, CALLER),
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
            service.invoke(WS, "report.post", { runId: RUN, agentId: AGENT, trigger: "tag" }, CALLER),
        ).rejects.toMatchObject({ code: "TOOLS_NATIVE_REFUSED" })
        await expect(service.invoke(WS, "report.post", { runId: "x" }, CALLER)).rejects.toMatchObject({
            code: "TOOLS_INVALID_ARGUMENTS",
        })
        await expect(service.invoke(WS, "approval.post", {}, CALLER)).rejects.toMatchObject({
            code: "TOOLS_UNKNOWN_TOOL",
        })
        await expect(service.invoke(WS, "other", {}, CALLER)).rejects.toMatchObject({
            code: "TOOLS_UNKNOWN_TOOL",
        })
    })

    // E-FIX2 listed `idempotencyArg: "runId"` (a required uuid) as a replay-key member the gateway's `nivo:<sha>` could never satisfy.
    // Read (E-FIX3, R52): no defect. The gateway checks the argument schema BEFORE it fills a key (`tool-registry.service.ts`), so a call
    // with no runId is refused there and the fill never runs; a call names its run, the fill leaves it, and a timed-out post replayed by
    // that key writes nothing twice (the card store keeps one report per room, kind and run: `insertCard` ... `orIgnore`). The run IS the
    // replay key of a report.
    it("takes the run as the report's replay key: a named run is kept as given, a call naming none is refused before any fill", () => {
        const [spec] = TEAM_CHAT_MANIFEST.tools
        if (spec === undefined) throw new Error("report.post")
        const args = { runId: RUN, agentId: AGENT, trigger: "zalo" }
        const caller = { workspaceId: WS, agentId: AGENT, conversationId: null, workItemId: "item-1" }

        expect(spec.idempotencyArg).toBe("runId")
        expect(withReplayKey(spec, caller, "nivo.tool.team-chat.report.post", args)).toBe(args)
        expect(POST_REPORT_SCHEMA.safeParse({ agentId: AGENT, trigger: "zalo" }).success).toBe(false)
    })
})
