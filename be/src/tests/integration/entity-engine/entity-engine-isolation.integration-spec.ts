import { eachInOrder } from "@modules/platform/primitives"
import {
    engineTenantIds,
    persistEngineTenants,
    type EngineTenants,
} from "../../fixtures/builders/entity-engine-tenants.builder"
import {
    BECOME_BACKEND,
    BECOME_POSTGRES,
    ENGINE_TABLES,
    IDENTITY,
    WORKSPACES_OF,
} from "../../world/entity-engine-scope.sql"
import {
    LEAD_ENTITY,
    changeRecord,
    ensureCounter,
    leadData,
    moveRecord,
    recordsOfWorkspace,
    removeRecord,
    visibleRecordWorkspaces,
} from "../../world/entity-engine-records.service"
import { catalogRows, withBackendSession, withBackendTransaction } from "../../world/entity-engine-scope-proof.service"
import { insertCounter, insertRecord } from "../../fixtures/builders/entity-engine-writes.builder"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [] })

/** SQLSTATE of a missing privilege or a row-level security refusal. */
const PRIVILEGE = "42501"
/** SQLSTATE of the null-workspace refusal of the scope function. */
const NULL_SCOPE = "22004"
/** SQLSTATE of a CHECK violation (here: no partition for an undeclared entity). */
const CHECK = "23514"

const seed = async (): Promise<EngineTenants> => {
    const tenants = engineTenantIds(() => world.id())
    await persistEngineTenants(world.db.primary, tenants, (work) => world.cleanup(work))
    return tenants
}

describe("isolation.read: a statement with no WHERE still sees one workspace", () => {
    it("scope A reads only A's records, and asking for B finds nothing", async () => {
        const { a, b } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const seen = await visibleRecordWorkspaces(probe.manager)
            expect(seen).toEqual([a.workspaceId, a.workspaceId])
            expect(await recordsOfWorkspace(probe.manager, b.workspaceId)).toBe(0)
        })
    })

    it("a scoped transaction cannot enter another workspace: the engine role cannot run the scope function", async () => {
        const { a, b } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            expect(await probe.refusalToEnter(b.workspaceId)).toBe(PRIVILEGE)
            const seen = await visibleRecordWorkspaces(probe.manager)
            expect(seen.every((workspaceId) => workspaceId === a.workspaceId)).toBe(true)
        })
    })
})

describe("isolation.write: a statement cannot touch or move another workspace's row", () => {
    it("updating or deleting B's record from scope A touches nothing", async () => {
        const { a, b } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            expect(await changeRecord(probe.manager, LEAD_ENTITY, b.recordId, "1", leadData("x"))).toBe(0)
            expect(await removeRecord(probe.manager, LEAD_ENTITY, b.recordId)).toBe(0)
            expect(await changeRecord(probe.manager, LEAD_ENTITY, a.recordId, "1", leadData("y"))).toBe(1)
        })
    })

    it("moving A's record to B is refused by the policy check", async () => {
        const { a, b } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const refusal = await probe.attempt((manager) =>
                moveRecord(manager, LEAD_ENTITY, a.recordId, b.workspaceId),
            )
            expect(refusal).toBe(PRIVILEGE)
        })
    })

    it("inserting a record for B under scope A is refused, and for A is accepted", async () => {
        const { a, b } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const foreign = await probe.attempt((manager) =>
                insertRecord(manager, LEAD_ENTITY, world.id(), b.workspaceId, leadData("Foreign")),
            )
            expect(foreign).toBe(PRIVILEGE)
            const own = await probe.attempt((manager) =>
                insertRecord(manager, LEAD_ENTITY, world.id(), a.workspaceId, leadData("Own")),
            )
            expect(own).toBeNull()
        })
    })

    it("inserting a counter for B under scope A is refused, and for A is accepted", async () => {
        const { a, b } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const key = { entity: "sales.order", field: "orderNo", period: "" }
            expect(
                await probe.attempt((manager) => insertCounter(manager, { ...key, workspaceId: b.workspaceId })),
            ).toBe(PRIVILEGE)
            expect(
                await probe.attempt((manager) => insertCounter(manager, { ...key, workspaceId: a.workspaceId })),
            ).toBeNull()
        })
    })

    it("an insert for an undeclared entity fails: there is no default partition", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            const refusal = await probe.attempt((manager) =>
                insertRecord(manager, "undeclared.entity", world.id(), a.workspaceId, {}),
            )
            expect(refusal).toBe(CHECK)
        })
    })
})

describe("isolation.fail-closed: the back-end role without a scope reaches nothing of the engine", () => {
    it.each(ENGINE_TABLES)("%s: a read is refused before the scope is entered", async (table) => {
        await withBackendTransaction(world, async (probe) => {
            expect(await probe.refusal(WORKSPACES_OF[table])).toBe(PRIVILEGE)
        })
    })

    it("an insert into the records or the counters is refused before the scope is entered", async () => {
        await withBackendTransaction(world, async (probe) => {
            const record = await probe.attempt((manager) =>
                insertRecord(manager, LEAD_ENTITY, world.id(), world.id(), leadData("Unscoped")),
            )
            expect(record).toBe(PRIVILEGE)
            const counter = await probe.attempt((manager) =>
                ensureCounter(manager, {
                    workspaceId: world.id(),
                    entity: "sales.order",
                    field: "orderNo",
                    period: "",
                }),
            )
            expect(counter).toBe(PRIVILEGE)
        })
    })

    it("entering the scope with null is refused with the declared SQLSTATE", async () => {
        await withBackendTransaction(world, async (probe) => {
            expect(await probe.refusalToEnter(null)).toBe(NULL_SCOPE)
        })
    })

    it("the engine role cannot become a role the back end is not a member of", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            expect(await probe.refusal(BECOME_POSTGRES)).toBe(PRIVILEGE)
        })
    })

    it("restoring the session role inside the transaction closes the engine tables again", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            expect(await visibleRecordWorkspaces(probe.manager)).toHaveLength(2)
            await probe.rows(BECOME_BACKEND)
            expect((await probe.identity()).role).toBe("app_be")
            expect(await probe.refusal(WORKSPACES_OF.records)).toBe(PRIVILEGE)
        })
    })
})

describe("isolation.guc-leak: nothing of a scope survives the transaction on a pooled connection", () => {
    it.each(["commit", "rollback"] as const)(
        "after %s the session is app_be with an empty workspace",
        async (ending) => {
            const { a } = await seed()
            await withBackendSession(world, async (probe) => {
                await probe.begin()
                await probe.enter(a.workspaceId)
                expect(await probe.identity()).toEqual({
                    role: "app_engine",
                    session: "app_be",
                    workspace: a.workspaceId,
                })
                await (ending === "commit" ? probe.commit() : probe.rollback())
                expect(await probe.identity()).toEqual({ role: "app_be", session: "app_be", workspace: "" })
                await probe.begin()
                expect(await probe.refusal(WORKSPACES_OF.records)).toBe(PRIVILEGE)
                await probe.rollback()
            })
        },
    )

    it("a second transaction on the same connection starts unscoped, then scopes to its own workspace", async () => {
        const { a, b } = await seed()
        await withBackendSession(world, async (probe) => {
            await eachInOrder([a.workspaceId, b.workspaceId], async (workspaceId) => {
                await probe.begin()
                expect([null, ""]).toContain((await probe.identity()).workspace)
                await probe.enter(workspaceId)
                const seen = await visibleRecordWorkspaces(probe.manager)
                expect(seen.every((seenWorkspace) => seenWorkspace === workspaceId)).toBe(true)
                await probe.commit()
            })
        })
    })

    it("the scope is the transaction-local setting, visible nowhere else", async () => {
        const { a } = await seed()
        await withBackendTransaction(world, async (probe) => {
            await probe.enter(a.workspaceId)
            expect((await probe.identity()).workspace).toBe(a.workspaceId)
        })
        const [after] = await catalogRows<{ workspace: string | null }>(world, IDENTITY)
        expect([null, ""]).toContain(after?.workspace)
    })
})
