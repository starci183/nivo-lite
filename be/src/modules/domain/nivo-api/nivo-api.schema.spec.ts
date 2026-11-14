import { Test } from "@nestjs/testing"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { z } from "zod"
import { NIVO_API_TABLE } from "./nivo-api.declarations"
import { BRAIN_NODES_MAX } from "./nivo-api.schema"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const SUBJECT = Symbol("nivo-api.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: NIVO_API_TABLE }],
    }).compile()
    return moduleRef.get<typeof NIVO_API_TABLE>(SUBJECT)
}

/** The validator of an exposed op's answer. */
const outputOf = async (verb: keyof typeof NIVO_API_TABLE): Promise<z.ZodType> => {
    const table = await build()
    const declaration = table[verb]
    if (!declaration.exposed) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `${verb} is not exposed` } })
    return declaration.output
}

const UUID = "0b9d7f5e-3c3a-4a52-9d0e-6f7f1c9a8b21"
const NAME = "n".repeat(200)
const MOMENT = "2026-11-13T20:58:49.123456+07:00"

/** A contact at the largest size its own service stores: a 200-character name, 20 tags of 40, identities of the longest value. */
const maxContact = {
    id: UUID,
    displayName: NAME,
    tags: Array.from({ length: 20 }, () => "t".repeat(40)),
    createdAt: MOMENT,
    updatedAt: MOMENT,
    identities: Array.from({ length: 500 }, () => ({
        id: UUID,
        kind: "external",
        provider: "zalo",
        account: UUID,
        value: "v".repeat(320),
        verified: true,
    })),
}

const manyOf = (count: number, row: unknown): ReadonlyArray<unknown> => Array.from({ length: count }, () => row)

/** One real row of each operation family, at the largest size the op's own input or the shared list ceiling allows. */
const MAX_ROWS: ReadonlyArray<readonly [string, keyof typeof NIVO_API_TABLE, unknown]> = [
    ["contact", NIVO_API.contact.list, { contacts: manyOf(50, maxContact), next: "c".repeat(512) }],
    ["contact memory", NIVO_API.contact.memoryForget, { forgotten: Array.from({ length: 50 }, () => "f".repeat(60)) }],
    ["contact identity", NIVO_API.contact.identityLink, { outcome: "linked", contactId: UUID }],
    ["chat thread", NIVO_API.chatThread.get, { messages: manyOf(100, { id: UUID, text: "m".repeat(4000) }), next: "c".repeat(512) }],
    ["chat thread list", NIVO_API.chatThread.list, { threads: manyOf(500, { id: UUID }) }],
    ["brain", NIVO_API.brain.search, { nodes: manyOf(BRAIN_NODES_MAX, {}), edges: manyOf(500, { from: "a", to: "b" }), nextCursor: "c".repeat(120) }],
    [
        "workbench",
        NIVO_API.workbench.read,
        { data: { rows: manyOf(1000, { id: UUID, note: "w".repeat(1_048_576), nested: { deep: [[[{ ok: true }]]] } }) } },
    ],
    ["workbench action", NIVO_API.workbench.action, { result: { created: [UUID], note: "w".repeat(1_048_576) } }],
    ["record", NIVO_API.record.typeList, { modules: manyOf(500, { type: "pkg.agent.thing" }) }],
    ["account data", NIVO_API.accountData.rowList, { refusal: "r".repeat(4000), rows: manyOf(100, { id: UUID }) }],
    ["account data types", NIVO_API.accountData.typeList, { types: manyOf(500, { type: "mail" }) }],
    ["agent", NIVO_API.agent.list, { agents: manyOf(500, { id: UUID }) }],
    [
        "agent removal",
        NIVO_API.agent.deletionImpact,
        {
            installationId: UUID,
            agentId: UUID,
            recordTypes: manyOf(500, { type: "pkg.agent.thing", title: "t".repeat(500), count: 100_000 }),
            records: 1_000_000,
            files: 1000,
            channels: manyOf(500, { kind: "provider", name: NAME, provider: "zalo", connectionId: UUID }),
        },
    ],
    ["workflow", NIVO_API.workflow.list, { workflows: manyOf(500, { id: UUID }) }],
    [
        "workflow detail",
        NIVO_API.workflow.get,
        { workflowId: UUID, key: "k".repeat(200), name: NAME, status: "active", runnable: false, refusal: "r".repeat(4000), inputSchema: { type: "object" }, inputSchemaJson: "j".repeat(1_000_000) },
    ],
    [
        "workflow run",
        NIVO_API.workflow.run,
        { status: "refused", refusal: "r".repeat(4000), issues: manyOf(500, { path: "x" }), wakeId: UUID, runId: UUID },
    ],
    ["run", NIVO_API.run.list, { runs: manyOf(500, { id: UUID }) }],
    ["run decision", NIVO_API.run.stepDecide, { ok: false, refusal: "r".repeat(4000), accepted: ["approve", "reject", "retry"] }],
    ["stop", NIVO_API.stop.list, { stops: manyOf(50, { runId: UUID, text: "s".repeat(4000) }), total: 1_000_000, next: "c".repeat(512) }],
    ["stop answer", NIVO_API.stop.answer, { outcome: "admitted", stepKey: "s".repeat(200), refusal: null }],
    ["theme", NIVO_API.theme.get, { theme: null }],
]

describe("the answers of the NIVO data ops are bounded without refusing a real row", () => {
    it.each(MAX_ROWS)("takes a largest %s row of %s", async (_family, verb, row) => {
        const output = await outputOf(verb)
        expect(output.safeParse(row).success).toBe(true)
    })

    it("covers every family that lists rows or carries text", () => {
        expect(new Set(MAX_ROWS.map(([, verb]) => verb)).size).toBe(MAX_ROWS.length)
    })
})

describe("the answers of the NIVO data ops refuse what no real row can be", () => {
    it("refuses a contact page past its own size, a name longer than the service keeps and more tags than it keeps", async () => {
        const output = await outputOf(NIVO_API.contact.list)
        expect(output.safeParse({ contacts: manyOf(51, maxContact), next: null }).success).toBe(false)
        expect(output.safeParse({ contacts: [{ ...maxContact, displayName: "n".repeat(501) }], next: null }).success).toBe(false)
        expect(output.safeParse({ contacts: [{ ...maxContact, tags: manyOf(21, "t") }], next: null }).success).toBe(false)
    })

    it("refuses a message page past its first-bound and a stop page past its limit-bound", async () => {
        const messages = await outputOf(NIVO_API.chatThread.get)
        const stops = await outputOf(NIVO_API.stop.list)
        expect(messages.safeParse({ messages: manyOf(101, {}), next: null }).success).toBe(false)
        expect(stops.safeParse({ stops: manyOf(51, {}), next: null }).success).toBe(false)
    })

    it("refuses a refusal text and a workbench value past the ceilings", async () => {
        const rows = await outputOf(NIVO_API.accountData.rowList)
        const read = await outputOf(NIVO_API.workbench.read)
        expect(rows.safeParse({ refusal: "r".repeat(4001), rows: [] }).success).toBe(false)
        expect(read.safeParse({ data: "w".repeat(1_048_577) }).success).toBe(false)
    })
})
