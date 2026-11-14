import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ToolRegistryService } from "@modules/domain/tools"
import type { ToolCallResult } from "@modules/domain/tools"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { NodeRightsSwitchService } from "@modules/domain/tool-grants"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { PassageFound } from "@modules/domain/knowledge"
import { BRAIN_NOTICE } from "@modules/domain/native-tools/brain-native.service"
import { searchAnswerOf } from "@modules/domain/native-tools/passage-native.policy"
import { PASSAGE_SEARCH_SCHEMA } from "@modules/domain/native-tools/passage-native.schema"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DomainError } from "@modules/platform/errors"
import { InternalReaderService } from "./internal-reader.service"
import { PublicDocumentsLogEvent } from "./public-documents.log-events"

const WS = "11111111-1111-4111-8111-111111111111"
const SOURCE = "22222222-2222-4222-8222-222222222222"
const document = { id: SOURCE, title: "Delivery policy", contentHash: "h1", text: "Same day delivery." }
const answer = (value: Record<string, unknown>): ToolCallResult => ({ ok: true, value: { notice: "n", ...value } })
const refusal = (code: "internal_only" | "not_granted" | "tool_error"): ToolCallResult => ({
    ok: false,
    code,
    detail: code,
})

const build = async () => {
    const gateway = mock<ToolRegistryService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InternalReaderService,
            { provide: ToolRegistryService, useValue: gateway },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: mock<WorkspaceMembersService>() },
            { provide: KnowledgeSourcesReadService, useValue: mock<KnowledgeSourcesReadService>() },
        ],
    }).compile()
    return { reader: moduleRef.get(InternalReaderService), gateway, logger }
}

describe("InternalReaderService read", () => {
    it("reads the document as the agent granted the tool, with no conversation", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        gateway.call.mockResolvedValue(answer({ document }))

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({
            kind: "ok",
            text: { sourceId: SOURCE, title: "Delivery policy", contentHash: "h1", text: "Same day delivery." },
        })
        expect(gateway.agentsGranted).toHaveBeenCalledWith(WS, [TOOL.brainDocumentRead])
        expect(gateway.call).toHaveBeenCalledWith(
            // The reader states its road (a call outside every workflow node), for the audit.
            { workspaceId: WS, agentId: "a1", conversationId: null, workItemId: null, origin: "document_reader" },
            TOOL.brainDocumentRead,
            { sourceId: SOURCE },
        )
    })

    it("has no right when no agent holds the tool, and calls nothing", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue([])

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "no_right" })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("passes over an agent that faces customers and uses the next one", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["chatbot", "sales"])
        gateway.call.mockResolvedValueOnce(refusal("internal_only")).mockResolvedValueOnce(answer({ document }))

        await expect(reader.read(WS, SOURCE)).resolves.toMatchObject({ kind: "ok" })
        expect(gateway.call).toHaveBeenCalledTimes(2)
    })

    it("has no right when every granted agent is passed over", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["chatbot", "support"])
        gateway.call.mockResolvedValueOnce(refusal("internal_only")).mockResolvedValueOnce(refusal("not_granted"))

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "no_right" })
    })

    it("is refused, and logs it, when the tool refuses the document", async () => {
        const { reader, gateway, logger } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        gateway.call.mockResolvedValue(refusal("tool_error"))

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "refused" })
        expect(logger.warn).toHaveBeenCalledWith("public_documents.read.refused", {
            tool: TOOL.brainDocumentRead,
            code: "tool_error",
        })
    })

    it.each([{}, { document: "x" }, { document: { title: "T", text: "t" } }, { document: { ...document, title: 1 } }])(
        "is refused for an answer without the shape %j",
        async (value) => {
            const { reader, gateway } = await build()
            gateway.agentsGranted.mockResolvedValue(["a1"])
            gateway.call.mockResolvedValue(answer(value))

            await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "refused" })
        },
    )
})

describe("InternalReaderService hits", () => {
    it("names the distinct documents of the passages, best first, three at most", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        const hit = (doc: unknown) => ({ id: "p", doc, title: "t", snippet: "c" })
        gateway.call.mockResolvedValue(
            answer({
                hits: [hit("s1"), hit("s2"), hit("s1"), hit(4), "x", hit("s3"), hit("s4")],
            }),
        )

        await expect(reader.hits(WS, "Do you deliver tonight?")).resolves.toEqual({
            kind: "ok",
            sourceIds: ["s1", "s2", "s3"],
        })
        expect(gateway.agentsGranted).toHaveBeenCalledWith(WS, [TOOL.brainPassageSearch])
        expect(gateway.call).toHaveBeenCalledWith(expect.anything(), TOOL.brainPassageSearch, {
            query: "Do you deliver tonight?",
            limit: 6,
        })
    })

    it("names none for an answer with no hits", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        gateway.call.mockResolvedValue(answer({ hits: [] }))

        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "ok", sourceIds: [] })
    })

    it("has no right without a grant", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue([])

        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "no_right" })
    })
})

/** The refusal the members capability answers for a person who is no longer an active member (its own class is not exported). */
class WorkspaceMembersErrorDouble extends DomainError<"WORKSPACE_MEMBERS_NOT_MEMBER"> {}

const MEMBER_USER = "33333333-3333-4333-8333-333333333333"
const SEAT = "44444444-4444-4444-8444-444444444444"
const STORED = {
    id: SOURCE,
    title: "Delivery policy",
    visibility: "internal" as const,
    status: "ready" as const,
    contentHash: "h1",
    module: "sales",
    installationId: null,
    topic: null,
    content: "Same day delivery. Call 0912 345 678.",
}

/** The reader in a workspace whose switch reads `on`, one agent granted the tools, and the member and the document as given. */
const buildWith = async (on: boolean, member: "active" | "gone" = "active") => {
    const gateway = mock<ToolRegistryService>()
    gateway.agentsGranted.mockResolvedValue(["a1"])
    gateway.call.mockResolvedValue(answer({ document, hits: [{ doc: SOURCE }] }))
    const nodeSwitch = mock<NodeRightsSwitchService>()
    nodeSwitch.decides.mockResolvedValue(on)
    const members = mock<WorkspaceMembersService>()
    if (member === "active") members.idOf.mockResolvedValue(SEAT)
    else members.idOf.mockRejectedValue(new WorkspaceMembersErrorDouble({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" }))
    const sources = mock<KnowledgeSourcesReadService>()
    sources.textOf.mockResolvedValue(STORED)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InternalReaderService,
            { provide: ToolRegistryService, useValue: gateway },
            { provide: LOGGER, useValue: logger },
            { provide: NodeRightsSwitchService, useValue: nodeSwitch },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: KnowledgeSourcesReadService, useValue: sources },
        ],
    }).compile()
    return { reader: moduleRef.get(InternalReaderService), gateway, members, sources, logger }
}

const AS_AGENT = {
    kind: "ok",
    text: { sourceId: SOURCE, title: "Delivery policy", contentHash: "h1", text: "Same day delivery." },
}

describe("H4, the internal reader, and the node rights switch (rights follow who asked)", () => {
    it("OFF: a member's draft and a customer question's search read exactly as before, as the first agent granted", async () => {
        const { reader, gateway, members, sources } = await buildWith(false)

        await expect(reader.read(WS, SOURCE, MEMBER_USER)).resolves.toEqual(AS_AGENT)
        await expect(reader.read(WS, SOURCE)).resolves.toEqual(AS_AGENT)
        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "ok", sourceIds: [SOURCE] })
        expect(gateway.call.mock.calls.map(([caller]) => caller.agentId)).toEqual(["a1", "a1", "a1"])
        expect(members.idOf).not.toHaveBeenCalled()
        expect(sources.textOf).not.toHaveBeenCalled()
    })

    it("ON: a flipped workspace keeps internal drafting for a member: read as that person, scrubbed, and the audit line names the member", async () => {
        const { reader, gateway, members, logger } = await buildWith(true)

        await expect(reader.read(WS, SOURCE, MEMBER_USER)).resolves.toEqual({
            kind: "ok",
            text: {
                sourceId: SOURCE,
                title: "Delivery policy",
                contentHash: "h1",
                text: "Same day delivery. Call [phone].",
            },
        })
        expect(members.idOf).toHaveBeenCalledWith(MEMBER_USER, WS)
        expect(gateway.call).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(PublicDocumentsLogEvent.PersonRead, {
            workspaceId: WS,
            memberId: SEAT,
            sourceId: SOURCE,
            outcome: "ok",
        })
    })

    it("ON: a person who is no longer a member reads nothing; a document that is not internal and ready is refused", async () => {
        const gone = await buildWith(true, "gone")
        await expect(gone.reader.read(WS, SOURCE, MEMBER_USER)).resolves.toEqual({ kind: "no_right" })
        expect(gone.sources.textOf).not.toHaveBeenCalled()

        const shared = await buildWith(true)
        shared.sources.textOf.mockResolvedValue({ ...STORED, visibility: "public" })
        await expect(shared.reader.read(WS, SOURCE, MEMBER_USER)).resolves.toEqual({ kind: "refused" })
    })

    it("ON: a read no person asked for (no node either) keeps the agent-level rule exactly as before", async () => {
        const { reader, gateway, members } = await buildWith(true)

        await expect(reader.read(WS, SOURCE)).resolves.toEqual(AS_AGENT)
        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "ok", sourceIds: [SOURCE] })
        expect(gateway.call.mock.calls.map(([caller]) => caller.agentId)).toEqual(["a1", "a1"])
        expect(members.idOf).not.toHaveBeenCalled()
    })

    it("ON: no person, no node and no agent-level right: refused, nothing is read", async () => {
        const { reader, gateway } = await buildWith(true)
        gateway.agentsGranted.mockResolvedValue([])

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "no_right" })
        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "no_right" })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

/** One passage the retrieval found, as `PassageRetrievalService.search` hands it to the passage tool. */
const foundOf = (id: string, sourceId: string, customerReady = true): PassageFound => ({
    id,
    sourceId,
    title: `Doc ${sourceId}`,
    updatedAt: "2026-11-10T00:00:00.000Z",
    documentPassages: 4,
    order: 0,
    place: null,
    module: null,
    visibility: "public",
    customerReady,
    legs: ["words", "meaning"],
    score: 0.9,
    complete: true,
    content: "We deliver the same day inside the city.",
})

/**
 * The gateway as the natives answer TODAY, by tool: `nivo.tool.brain.search` answers truths only (`notice`, `facts`; what the documents
 * say moved to the passage tool), and `nivo.tool.brain.passage.search` answers the passage tool's own answer (`searchAnswerOf`: `hits`
 * with `doc`). The arguments are checked by the passage tool's own validator, as the gateway does before it runs the tool.
 */
const realGateway = (gateway: ReturnType<typeof mock<ToolRegistryService>>, found: ReadonlyArray<PassageFound>) => {
    gateway.agentsGranted.mockResolvedValue(["a1"])
    gateway.call.mockImplementation((_caller, tool, args): Promise<ToolCallResult> => {
        if (tool === TOOL.brainSearch) return Promise.resolve({ ok: true, value: { notice: BRAIN_NOTICE, facts: [] } })
        if (tool !== TOOL.brainPassageSearch)
            return Promise.resolve({ ok: false, code: "unknown_tool", detail: tool })
        const parsed = PASSAGE_SEARCH_SCHEMA.safeParse(args)
        if (!parsed.success) return Promise.resolve({ ok: false, code: "invalid_arguments", detail: tool })
        const value = searchAnswerOf({ legs: ["words", "meaning"], hits: found, next: null }, parsed.data.query, true)
        return Promise.resolve({ ok: true, value })
    })
}

describe("InternalReaderService hits, against the tools' real answers (proposals found nothing)", () => {
    it("finds the documents of a customer question from the passage tool's hits, distinct, best first, three at most", async () => {
        const { reader, gateway } = await build()
        realGateway(gateway, [
            foundOf("p1", "s1"),
            foundOf("p2", "s2"),
            foundOf("p3", "s1"),
            foundOf("p4", "s3", false),
            foundOf("p5", "s4"),
        ])

        await expect(reader.hits(WS, "Do you deliver tonight?")).resolves.toEqual({
            kind: "ok",
            sourceIds: ["s1", "s2", "s3"],
        })
        expect(gateway.agentsGranted).toHaveBeenCalledWith(WS, [TOOL.brainPassageSearch])
    })

    it("asks within the passage tool's bounds for a long question, so the gateway does not refuse the arguments", async () => {
        const { reader, gateway } = await build()
        realGateway(gateway, [foundOf("p1", "s1")])

        await expect(reader.hits(WS, "x".repeat(800))).resolves.toEqual({ kind: "ok", sourceIds: ["s1"] })
    })

    it("an answer that is not the passage tool's shape is a typed refusal, never an empty find", async () => {
        const { reader, gateway, logger } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        gateway.call.mockResolvedValue({ ok: true, value: { notice: BRAIN_NOTICE, facts: [] } })

        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "refused", code: "answer_unreadable" })
        expect(logger.warn).toHaveBeenCalledWith(PublicDocumentsLogEvent.ReadRefused, {
            tool: TOOL.brainPassageSearch,
            code: "answer_unreadable",
        })
    })

    it("a gateway refusal surfaces with its code (an unknown tool, refused arguments), never as nothing found", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        gateway.call.mockResolvedValue({ ok: false, code: "unknown_tool", detail: TOOL.brainPassageSearch })

        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "refused", code: "unknown_tool" })
    })

    it("a search that truly found nothing is an empty find", async () => {
        const { reader, gateway } = await build()
        realGateway(gateway, [])

        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "ok", sourceIds: [] })
    })
})
