import { Test } from "@nestjs/testing"
import { pendingLineOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { freezeOf, pendingJsonOf, pendingOf } from "./lead-freezes.mapper"
import { ContactFreezeEntity } from "./persistence/entities"

const SUBJECT = Symbol("lead-freezes.mapper")

/** The mapper as Nest hands it to a caller. */
interface Mapper {
    readonly freezeOf: typeof freezeOf
    readonly pendingJsonOf: typeof pendingJsonOf
    readonly pendingOf: typeof pendingOf
}

const buildMapper = async (): Promise<Mapper> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { freezeOf, pendingJsonOf, pendingOf } }],
    }).compile()
    return moduleRef.get<Mapper>(SUBJECT)
}

const EVENT = pendingLineOf({ context: { conversationId: "c-1", lookupName: false }, folded: true })

/** A row of the freezes table as Postgres hands it back, with the members a case sets. */
const rowOf = (values: Partial<Record<keyof ContactFreezeEntity, unknown>>): ContactFreezeEntity =>
    Object.assign(new ContactFreezeEntity(), {
        id: "freeze-1",
        workspaceId: "ws-1",
        version: 7,
        createdAt: new Date("2026-11-04T10:00:00.000Z"),
        updatedAt: new Date("2026-11-04T10:00:00.000Z"),
        key: "",
        contactId: null,
        conversationId: null,
        status: "frozen",
        frozenRunId: null,
        agentId: null,
        frozenAt: null,
        frozenReason: null,
        stepKey: null,
        stepTitle: null,
        customerName: null,
        workItemId: null,
        episode: 0,
        failures: 0,
        heldBy: null,
        releasedAt: null,
        releasedBy: null,
        releaseReason: null,
        pending: { events: [] },
        ...values,
    })

describe("lead-freezes.mapper", () => {
    it("keeps the pending events as plain JSON under `events` and reads them back the same", async () => {
        const mapper = await buildMapper()
        const json = mapper.pendingJsonOf([EVENT])
        expect(json).toEqual({ events: [{ ...EVENT }] })
        expect(mapper.pendingOf(json)).toEqual([EVENT])
    })

    it("skips an entry that is not an event and reads the defaults of a thin one", async () => {
        const mapper = await buildMapper()
        const thin = { wakeId: "w", agentId: "a", kind: "unknown", context: { a: 1, b: "x" }, messageIds: ["m", 2] }
        expect(mapper.pendingOf({ events: [null, { agentId: "a" }, thin] })).toEqual([
            {
                wakeId: "w",
                agentId: "a",
                source: "",
                eventKey: "w",
                scopeKey: "",
                context: { b: "x" },
                actorMemberId: null,
                kind: "event",
                at: "",
                conversationId: null,
                messageIds: ["m"],
                folded: false,
            },
        ])
        expect(mapper.pendingOf(null)).toEqual([])
        expect(mapper.pendingOf({ events: "no" })).toEqual([])
        expect(mapper.pendingOf({ events: [{ wakeId: "w", agentId: "a", context: [] }] })[0]?.context).toEqual({})
    })

    it("reads a freeze row, with a status it does not know read as released and counts read as numbers", async () => {
        const mapper = await buildMapper()
        const row = rowOf({
            key: "contact:lead-1",
            contactId: "lead-1",
            status: "frozen",
            frozenRunId: "run-1",
            episode: 2,
            failures: 1,
            pending: { events: [{ ...EVENT }] },
        })
        expect(mapper.freezeOf(row)).toMatchObject({
            id: "freeze-1",
            version: "7",
            key: "contact:lead-1",
            contactId: "lead-1",
            conversationId: null,
            status: "frozen",
            frozenRunId: "run-1",
            episode: 2,
            failures: 1,
            pending: [EVENT],
        })
        expect(mapper.freezeOf(rowOf({ status: "odd", episode: Number.NaN }))).toMatchObject({
            status: "released",
            episode: 0,
            key: "",
        })
    })
})
