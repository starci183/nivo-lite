import {
    engineTenantIds,
    persistEngineTenants,
    type EngineTenants,
} from "../../fixtures/builders/entity-engine-tenants.builder"
import {
    LEAD_ENTITY,
    changeRecord,
    counterValue,
    ensureCounter,
    leadData,
    nextNumber,
    removeRecord,
    unlinkFrom,
    versionOf,
} from "../../world/entity-engine-records.service"
import {
    concurrentScopedTransactions,
    withBackendTransaction,
    type ScopeProbe,
} from "../../world/entity-engine-scope-proof.service"
import {
    type CounterKey,
    type RecordData,
    insertCounter,
    insertRecord,
    linkRecords,
} from "../../fixtures/builders/entity-engine-writes.builder"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [] })

/** SQLSTATE of a unique violation. */
const UNIQUE = "23505"
/** SQLSTATE of a CHECK violation. */
const CHECK = "23514"
/** SQLSTATE of a foreign key violation. */
const FOREIGN_KEY = "23503"
const RELATION = "lead"

const seed = async (): Promise<EngineTenants> => {
    const tenants = engineTenantIds(() => world.id())
    await persistEngineTenants(world.db.primary, tenants, (work) => world.cleanup(work))
    return tenants
}

const counter = (workspaceId: string, period = "", entity = "sales.order", field = "orderNo"): CounterKey => ({
    workspaceId,
    entity,
    field,
    period,
})

const lead = (id: string) => ({ entity: LEAD_ENTITY, id })

describe("constraints: the partition of sales.lead", () => {
    it("accepts a lead that satisfies the declared fields and refuses one that does not", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const attempt = (data: RecordData): Promise<string | null> =>
                probe.attempt((manager) => insertRecord(manager, LEAD_ENTITY, world.id(), a.workspaceId, data))
            expect(await attempt(leadData("Valid"))).toBeNull()
            expect(await attempt({ channel: "zalo", stage: "new" })).toBe(CHECK)
            expect(await attempt(leadData("Bad stage", { stage: "dreaming" }))).toBe(CHECK)
            expect(await attempt(leadData("Bad channel", { channel: "pigeon" }))).toBe(CHECK)
        })
    })

    it("a phone is unique inside a workspace and free in another", async () => {
        const { a, b } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const phone = "0900000001"
            const insert = (name: string): Promise<string | null> =>
                probe.attempt((manager) =>
                    insertRecord(manager, LEAD_ENTITY, world.id(), a.workspaceId, leadData(name, { phone })),
                )
            expect(await insert("First")).toBeNull()
            expect(await insert("Second")).toBe(UNIQUE)
        })
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(b.workspaceId)
            const other = await probe.attempt((manager) =>
                insertRecord(
                    manager,
                    LEAD_ENTITY,
                    world.id(),
                    b.workspaceId,
                    leadData("Other", { phone: "0900000001" }),
                ),
            )
            expect(other).toBeNull()
        })
    })
})

describe("constraints: the counters", () => {
    it("a second first use leaves the first row, and the counter starts at zero", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            await ensureCounter(probe.manager, counter(a.workspaceId))
            await ensureCounter(probe.manager, counter(a.workspaceId))
            expect(await counterValue(probe.manager, counter(a.workspaceId))).toBe("0")
        })
    })

    it("refuses a duplicate key, an entity over 120 characters, a field over 60, a period over 10 and a negative value", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const insert = (key: CounterKey, value?: string): Promise<string | null> =>
                probe.attempt((manager) => insertCounter(manager, key, value))
            expect(await insert(counter(a.workspaceId))).toBeNull()
            expect(await insert(counter(a.workspaceId))).toBe(UNIQUE)
            expect(await insert(counter(a.workspaceId, "", "x".repeat(121)))).toBe(CHECK)
            expect(await insert(counter(a.workspaceId, "", "x".repeat(120)))).toBeNull()
            expect(await insert(counter(a.workspaceId, "", "sales.order", "y".repeat(61)))).toBe(CHECK)
            expect(await insert(counter(a.workspaceId, "2026-11-05x"))).toBe(CHECK)
            expect(await insert(counter(a.workspaceId, "", "sales.order", "other"), "-1")).toBe(CHECK)
        })
    })

    it("each period is its own counter: a new month starts again at one", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            await ensureCounter(probe.manager, counter(a.workspaceId, "2026-10"))
            await ensureCounter(probe.manager, counter(a.workspaceId, "2026-11"))
            expect(await nextNumber(probe.manager, counter(a.workspaceId, "2026-10"))).toBe("1")
            expect(await nextNumber(probe.manager, counter(a.workspaceId, "2026-10"))).toBe("2")
            expect(await nextNumber(probe.manager, counter(a.workspaceId, "2026-11"))).toBe("1")
        })
    })

    it("two concurrent first uses leave one row at zero and no error", async () => {
        const { a } = await seed()
        const ensure = (probe: ScopeProbe): Promise<void> => ensureCounter(probe.manager, counter(a.workspaceId))
        const outcomes = await concurrentScopedTransactions(world, a.workspaceId, [ensure, ensure])
        expect(outcomes.map((outcome) => outcome.sqlstate)).toEqual([null, null])
        const [read] = await concurrentScopedTransactions(world, a.workspaceId, [
            (probe) => counterValue(probe.manager, counter(a.workspaceId)),
        ])
        expect(read?.result).toBe("0")
    })

    it("hands out distinct, gapless numbers to concurrent transactions of one workspace", async () => {
        const { a } = await seed()
        await concurrentScopedTransactions(world, a.workspaceId, [
            (probe) => ensureCounter(probe.manager, counter(a.workspaceId)),
        ])
        const take = (probe: ScopeProbe): Promise<string | null> => nextNumber(probe.manager, counter(a.workspaceId))
        const outcomes = await concurrentScopedTransactions(world, a.workspaceId, [take, take, take, take, take])
        const numbers = outcomes.map((outcome) => outcome.result)
        expect(numbers.toSorted((left, right) => String(left).localeCompare(String(right)))).toEqual([
            "1",
            "2",
            "3",
            "4",
            "5",
        ])
    })

    it("another workspace's counter is out of reach", async () => {
        const { a, b } = await seed()
        await concurrentScopedTransactions(world, b.workspaceId, [
            (probe) => ensureCounter(probe.manager, counter(b.workspaceId)),
        ])
        const [foreign] = await concurrentScopedTransactions(world, a.workspaceId, [
            (probe) => nextNumber(probe.manager, counter(b.workspaceId)),
        ])
        expect(foreign?.result).toBeNull()
    })
})

describe("constraints: the record links", () => {
    it("links two records of one workspace, and refuses a link to a record of another workspace", async () => {
        const { a, b } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const link = (toId: string): Promise<string | null> =>
                probe.attempt((manager) => linkRecords(manager, a.workspaceId, lead(a.recordId), RELATION, lead(toId)))
            expect(await link(a.otherRecordId)).toBeNull()
            expect(await link(a.otherRecordId)).toBe(UNIQUE)
            expect(await link(b.recordId)).toBe(FOREIGN_KEY)
        })
    })

    it("a record with a link cannot be deleted until the engine deletes its links first", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            await linkRecords(probe.manager, a.workspaceId, lead(a.recordId), RELATION, lead(a.otherRecordId))
            const refused = await probe.attempt((manager) => removeRecord(manager, LEAD_ENTITY, a.otherRecordId))
            expect(refused).toBe(FOREIGN_KEY)
            expect(await unlinkFrom(probe.manager, LEAD_ENTITY, a.recordId)).toBe(1)
            expect(await removeRecord(probe.manager, LEAD_ENTITY, a.otherRecordId)).toBe(1)
        })
    })
})

describe("constraints: the version of a record", () => {
    it("answers a writer holding an old version with no row, and bumps the version of the other", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            expect(await versionOf(probe.manager, LEAD_ENTITY, a.recordId)).toBe("1")
            expect(await changeRecord(probe.manager, LEAD_ENTITY, a.recordId, "1", leadData("one"))).toBe(1)
            expect(await versionOf(probe.manager, LEAD_ENTITY, a.recordId)).toBe("2")
            expect(await changeRecord(probe.manager, LEAD_ENTITY, a.recordId, "1", leadData("stale"))).toBe(0)
        })
    })

    it("two concurrent updates with the same expected version: one changes the row, the other finds it stale", async () => {
        const { a } = await seed()
        const write =
            (name: string) =>
            (probe: ScopeProbe): Promise<number> =>
                changeRecord(probe.manager, LEAD_ENTITY, a.recordId, "1", leadData(name))
        const outcomes = await concurrentScopedTransactions(world, a.workspaceId, [
            write("writer one"),
            write("writer two"),
        ])
        expect(outcomes.map((outcome) => outcome.result).toSorted((left, right) => (left ?? 0) - (right ?? 0))).toEqual(
            [0, 1],
        )
        const [read] = await concurrentScopedTransactions(world, a.workspaceId, [
            (probe) => versionOf(probe.manager, LEAD_ENTITY, a.recordId),
        ])
        expect(read?.result).toBe("2")
    })
})
