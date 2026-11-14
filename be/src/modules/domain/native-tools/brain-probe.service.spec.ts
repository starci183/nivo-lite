import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ToolsErrorCode } from "@modules/domain/tools"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { BRAIN_MANIFEST, BrainNativeService } from "./brain-native.service"
import { BRAIN_PROBE_TOOLS, BrainProbeService, probeArgumentsOf } from "./brain-probe.service"
import { nativeRefusal } from "./native-refusal.policy"
import { PASSAGE_MANIFEST, PassageNativeService } from "./passage-native.service"

const WS = "11111111-1111-4111-8111-111111111111"
const OWNER = "22222222-2222-4222-8222-222222222222"
const AGENT = "33333333-3333-4333-8333-333333333333"
const CONVERSATION = "44444444-4444-4444-8444-444444444444"
const AT = new Date("2026-11-13T13:00:00.000Z")

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const brain = mock<BrainNativeService>({ manifest: BRAIN_MANIFEST })
    const passages = mock<PassageNativeService>({ manifest: PASSAGE_MANIFEST })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainProbeService,
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainNativeService, useValue: brain },
            { provide: PassageNativeService, useValue: passages },
        ],
    }).compile()
    return { service: moduleRef.get(BrainProbeService), members, brain, passages }
}

describe("BrainProbeService: the owner runs one Brain read as an agent, through the tool's own code and with no model turn", () => {
    it("runs the truth search through the Brain family as the named agent and answers the tool's own JSON", async () => {
        const { service, members, brain, passages } = await build()
        brain.invoke.mockResolvedValue({ notice: "n", facts: [{ id: "f1" }] })

        await expect(
            service.run(OWNER, WS, { agentId: AGENT, tool: TOOL.brainSearch, arguments: '{"query":"delivery fee","limit":5}' }),
        ).resolves.toEqual({ tool: TOOL.brainSearch, ok: true, answer: '{"notice":"n","facts":[{"id":"f1"}]}', refusal: null, ms: 0 })

        // The owner alone: the role is proved before anything is read.
        expect(members.require).toHaveBeenCalledWith(OWNER, WS, ["owner"])
        expect(brain.invoke).toHaveBeenCalledWith(WS, "search", { query: "delivery fee", limit: 5 }, { agentId: AGENT, conversationId: null })
        expect(passages.invoke).not.toHaveBeenCalled()
    })

    it("runs a document search and a document read through the passage family, in a customer turn when a conversation is named", async () => {
        const { service, brain, passages } = await build()
        passages.invoke.mockResolvedValue({ hits: [] })

        await service.run(OWNER, WS, { agentId: AGENT, tool: TOOL.brainPassageSearch, arguments: '{"query":"SP-0015","mode":"words"}', conversationId: CONVERSATION })
        await service.run(OWNER, WS, { agentId: AGENT, tool: TOOL.brainPassageRead, arguments: '{"doc":"d1","at":3}' })

        expect(passages.invoke.mock.calls).toEqual([
            [WS, "passage.search", { query: "SP-0015", mode: "words" }, { agentId: AGENT, conversationId: CONVERSATION }],
            [WS, "passage.read", { doc: "d1", at: 3 }, { agentId: AGENT, conversationId: null }],
        ])
        expect(brain.invoke).not.toHaveBeenCalled()
    })

    it("answers an expected refusal of the tool as the model would read it, and throws any other failure", async () => {
        const { service, brain } = await build()
        brain.invoke.mockRejectedValueOnce(nativeRefusal("not_found"))

        await expect(service.run(OWNER, WS, { agentId: AGENT, tool: TOOL.brainFactGet, arguments: '{"id":"f9"}' })).resolves.toEqual({
            tool: TOOL.brainFactGet,
            ok: false,
            answer: null,
            refusal: "not_found",
            ms: 0,
        })

        brain.invoke.mockRejectedValueOnce(new Error("database down"))
        await expect(service.run(OWNER, WS, { agentId: AGENT, tool: TOOL.brainFactGet, arguments: '{"id":"f9"}' })).rejects.toThrow("database down")
    })

    it("refuses anyone but the owner before any tool runs", async () => {
        const { service, members, brain, passages } = await build()
        members.require.mockRejectedValue(new Error("not the owner"))

        await expect(service.run("someone", WS, { agentId: AGENT, tool: TOOL.brainSearch, arguments: "{}" })).rejects.toThrow("not the owner")
        expect(brain.invoke).not.toHaveBeenCalled()
        expect(passages.invoke).not.toHaveBeenCalled()
    })

    it.each([
        ["a tool that writes", TOOL.brainChangePropose, "{}"],
        ["the whole-document read", TOOL.brainDocumentRead, "{}"],
        ["a tool of another store", TOOL.contactGet, "{}"],
        ["arguments that are no JSON", TOOL.brainSearch, "query=fee"],
        ["arguments that are a list", TOOL.brainSearch, '["fee"]'],
        ["arguments that are a bare text", TOOL.brainSearch, '"fee"'],
    ])("refuses %s as invalid arguments and runs nothing", async (_case, tool, args) => {
        const { service, brain, passages } = await build()

        await expect(service.run(OWNER, WS, { agentId: AGENT, tool, arguments: args })).rejects.toMatchObject({
            code: ToolsErrorCode.InvalidArguments,
        })
        expect(brain.invoke).not.toHaveBeenCalled()
        expect(passages.invoke).not.toHaveBeenCalled()
    })

    it("probes exactly the Brain reads that answer through the lens: every one is a read tool a family declares", () => {
        const declared = [BRAIN_MANIFEST, PASSAGE_MANIFEST].flatMap((manifest) =>
            manifest.tools.filter((tool) => tool.scope === "read").map((tool) => `${manifest.namespace}.${tool.name}`),
        )

        expect(BRAIN_PROBE_TOOLS).toEqual([
            TOOL.brainSearch,
            TOOL.brainFactList,
            TOOL.brainFactGet,
            TOOL.brainFactRelated,
            TOOL.brainPassageSearch,
            TOOL.brainPassageRead,
        ])
        expect(BRAIN_PROBE_TOOLS.every((tool) => declared.includes(tool))).toBe(true)
        expect(probeArgumentsOf('{"a":1}')).toEqual({ a: 1 })
        expect(probeArgumentsOf("null")).toBeNull()
    })
})
