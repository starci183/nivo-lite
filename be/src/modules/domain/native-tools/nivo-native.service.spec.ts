import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ContextReadsService } from "@modules/domain/context-sources"
import type { ContextResult } from "@modules/domain/context-sources"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import type { NativeCaller } from "@modules/domain/mcp-gateway"
import { ConversationNativeService } from "./conversation-native.service"
import { LeadNativeService } from "./lead-native.service"
import { NivoNativeService } from "./nivo-native.service"
import { NativeViewService } from "./native-view.service"
import type { NativeView } from "./native-view.policy"

const WS = "ws-1"
const RESULT: ContextResult = { notice: "n", source: "nivo.lead", asOf: "2026-11-11T00:00:00.000Z", facts: [] }
const VIEW: NativeView = { workspaceId: WS, module: "sales", audience: "customer", installationId: null, searchable: true }
const STEP: NativeCaller = { agentId: "agent-1", conversationId: "conv-1", graphStep: true }

const build = async () => {
    const reads = mock<ContextReadsService>()
    reads.leadOfConversation.mockImplementation((_ws, id) => Promise.resolve(id === "conv-1" ? "lead-1" : null))
    reads.orders.mockResolvedValue(RESULT)
    reads.profile.mockResolvedValue(RESULT)
    reads.thread.mockResolvedValue({ ...RESULT, source: "nivo.conversation" })
    reads.notes.mockResolvedValue(RESULT)
    const views = mock<NativeViewService>()
    views.of.mockResolvedValue(VIEW)
    const moduleRef = await Test.createTestingModule({
        providers: [
            NivoNativeService,
            ConversationNativeService,
            LeadNativeService,
            { provide: ContextReadsService, useValue: reads },
            { provide: NativeViewService, useValue: views },
        ],
    }).compile()
    return { nivo: moduleRef.get(NivoNativeService), reads, views }
}

describe("NivoNativeService: the connector", () => {
    it("lists the context reads under the public prefix `nivo`, its row key its own", async () => {
        const { nivo } = await build()

        expect(nivo.manifest).toMatchObject({ key: "nivo-context", namespace: "nivo", kind: "native" })
        expect(nivo.manifest.tools.map((spec) => [spec.name, spec.scope])).toEqual([
            ["conversation.message.list", "read"],
            ["lead.profile.get", "read"],
            ["lead.order.list", "read"],
            ["lead.note.list", "read"],
        ])
        for (const spec of nivo.manifest.tools) {
            expect(JSON.stringify(spec.inputSchema)).not.toMatch(/conversationId|leadId/u)
        }
    })
})

describe("NivoNativeService: hard-locked to the run's own conversation and customer", () => {
    it("reads the customer the caller's conversation names, for the caller's audience", async () => {
        const { nivo, reads } = await build()

        await expect(nivo.invoke(WS, "lead.order.list", { limit: 3 }, STEP)).resolves.toEqual(RESULT)
        expect(reads.orders).toHaveBeenCalledWith(WS, { conversationId: "conv-1", leadId: "lead-1" }, "customer", 3)
    })

    it("refuses another conversation or another customer before any record is read", async () => {
        const { nivo, reads } = await build()

        await expect(nivo.invoke(WS, "lead.order.list", { conversationId: "conv-9" }, STEP)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "other_conversation" },
        })
        await expect(nivo.invoke(WS, "lead.profile.get", { leadId: "lead-9" }, STEP)).rejects.toMatchObject({
            params: { reason: "other_lead" },
        })
        expect(reads.orders).not.toHaveBeenCalled()
        expect(reads.profile).not.toHaveBeenCalled()
    })

    it("takes the door's customer for a step with no conversation; any other caller with no conversation reads no customer", async () => {
        const { nivo, reads } = await build()
        const bankFed: NativeCaller = { agentId: "agent-1", conversationId: null, graphStep: true }
        const surface: NativeCaller = { agentId: "agent-1", conversationId: null }

        await nivo.invoke(WS, "lead.note.list", { leadId: "lead-7" }, bankFed)
        await expect(nivo.invoke(WS, "lead.note.list", { leadId: "lead-7" }, surface)).rejects.toMatchObject({
            params: { reason: "other_lead" },
        })
        await nivo.invoke(WS, "lead.note.list", {}, surface)

        expect(reads.notes.mock.calls.map((call) => call[1])).toEqual([
            { conversationId: null, leadId: "lead-7" },
            { conversationId: null, leadId: null },
        ])
    })

    it("reads the thread of the caller's own conversation, and refuses a tool it does not have", async () => {
        const { nivo, reads } = await build()

        await nivo.invoke(WS, "conversation.message.list", {}, STEP)
        expect(reads.thread).toHaveBeenCalledWith(WS, { conversationId: "conv-1", leadId: "lead-1" }, 20)
        await expect(nivo.invoke(WS, "lead.secret.list", {}, STEP)).rejects.toBeDefined()
    })
})
