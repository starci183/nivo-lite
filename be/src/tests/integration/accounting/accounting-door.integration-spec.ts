import assert from "node:assert/strict"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityPortsService, ModuleJobRunnerService } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ORDER_AMOUNT, writeScene } from "../../fixtures/builders/accounting-scene.builder"
import type { SceneRecords, SceneWorkspace } from "../../fixtures/builders/accounting-scene.builder"
import { backendSandbox, workbenchDoorProofModules } from "../../world/workbench-door-proof.module"
import { refusedFieldsOf, rowsOf, useDoorProof } from "../../world/workbench-door-proof.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: workbenchDoorProofModules(), sandbox: backendSandbox })
const proof = useDoorProof(world)

/** The job that keeps the books: the one declared job of the module that calls no door tool, so the runner can run it on the engine alone. */
const BOOK_PROJECT = "accounting.book-project"

interface Scene extends SceneWorkspace, SceneRecords {
    readonly entities: EntitiesApi
}

/** A fresh workspace owned by a fresh user, with Dinh's order to cash written through the engine. */
const openScene = async (): Promise<Scene> => {
    const workspace: SceneWorkspace = { workspaceId: world.id(), userId: world.id() }
    await proof.persistWorkspace(workspace)
    const engine = world.resolve(EntityEngineService)
    const entities = world
        .resolve(EntityPortsService)
        .entitiesApi((use) => engine.scoped(workspace.workspaceId, use), "action")
    const clock: Clock = world.resolve(CLOCK)
    return { ...workspace, entities, ...(await writeScene(entities, clock.now())) }
}

const dataOf = async (scene: Scene, entity: string, id: string): Promise<Readonly<Record<string, unknown>> | null> => {
    const found = await scene.entities.get(entity, id)
    return found === null ? null : found.data
}

const jobNamesOf = async (scene: Scene): Promise<ReadonlyArray<string>> =>
    (await proof.deliveries(scene.workspaceId)).map((delivery) => delivery.job).toSorted((a, b) => a.localeCompare(b))

/** Settles a payment for the order of the scene. */
const settle = (scene: Scene, transactionId: string, extra: object = {}): Promise<unknown> =>
    proof.act(scene, "payment.settle", { transactionId, orderId: scene.orderId, ...extra })

/** Runs the book projections the settlement enqueued, as the module-jobs processor would. */
const runBookProjections = async (scene: Scene): Promise<void> => {
    const runner = world.resolve(ModuleJobRunnerService)
    const deliveries = (await proof.deliveries(scene.workspaceId)).filter((delivery) => delivery.job === BOOK_PROJECT)
    await Promise.all(
        deliveries.map((delivery) =>
            runner.run({
                jobId: delivery.id,
                kind: BOOK_PROJECT,
                fencingToken: 1,
                currentStep: null,
                payload: delivery.payload,
            }),
        ),
    )
}

describe("payment.settle through the door", () => {
    it("pays the order with the transaction and settles the claim in one transaction, and enqueues the three jobs", async () => {
        const scene = await openScene()
        await expect(settle(scene, scene.transactionId, { claimId: scene.claimId })).resolves.toEqual({
            ok: true,
            data: { result: "paid", orderId: scene.orderId },
        })
        expect(await dataOf(scene, "payment.transaction", scene.transactionId)).toMatchObject({
            status: "matched",
            orderId: scene.orderId,
        })
        expect(await dataOf(scene, "sales.order", scene.orderId)).toMatchObject({ status: "paid" })
        expect(await dataOf(scene, "payment.claim", scene.claimId)).toMatchObject({
            status: "settled",
            settledTransactionId: scene.transactionId,
        })
        expect(await jobNamesOf(scene)).toEqual([BOOK_PROJECT, "accounting.ledger-append", "payment.confirm-notice"])
    })

    it("changes nothing when the transaction already paid the order", async () => {
        const scene = await openScene()
        await settle(scene, scene.transactionId)
        const before = await jobNamesOf(scene)
        await expect(settle(scene, scene.transactionId)).resolves.toEqual({
            ok: true,
            data: { result: "already-paid", orderId: scene.orderId },
        })
        expect(await jobNamesOf(scene)).toEqual(before)
    })

    it("refuses a second payment of an order that is paid, and writes nothing", async () => {
        const scene = await openScene()
        await settle(scene, scene.transactionId)
        const before = await jobNamesOf(scene)
        await expect(settle(scene, scene.otherTransactionId)).resolves.toMatchObject({
            ok: false,
            reason: "refused",
            data: { reason: "order_not_open" },
        })
        expect(await dataOf(scene, "payment.transaction", scene.otherTransactionId)).toMatchObject({
            status: "unmatched",
        })
        expect(await jobNamesOf(scene)).toEqual(before)
    })

    it("answers a conflict when the order moved after the settlement read it, and rolls the writes before it back", async () => {
        const scene = await openScene()
        const engine = world.resolve(EntityEngineService)
        const ports = world.resolve(EntityPortsService)
        const order = await scene.entities.get("sales.order", scene.orderId)
        expect(order).not.toBeNull()
        let settling: Promise<unknown> | null = null
        await engine.scoped(scene.workspaceId, async (tx) => {
            const inside = ports.entitiesApi((use) => use(tx), "action")
            const moved = await inside.update("sales.order", scene.orderId, order?.version ?? "", { note: "changed" })
            expect(moved.ok).toBe(true)
            settling = settle(scene, scene.transactionId)
            await proof.untilBlocked()
        })
        await expect(settling).resolves.toMatchObject({ ok: false, reason: "conflict" })
        expect(await dataOf(scene, "payment.transaction", scene.transactionId)).toMatchObject({ status: "unmatched" })
        expect(await dataOf(scene, "sales.order", scene.orderId)).toMatchObject({
            status: "confirmed",
            note: "changed",
        })
        expect(await jobNamesOf(scene)).toEqual([])
    })

    it("answers invalid for an input the door never passes on", async () => {
        const scene = await openScene()
        await expect(settle(scene, "not-a-uuid")).resolves.toMatchObject({ ok: false, reason: "invalid" })
    })
})

describe("the books through the door", () => {
    it("lists, counts and details the entry a payment posted, searched by a word of the payer", async () => {
        const scene = await openScene()
        await settle(scene, scene.transactionId)
        await runBookProjections(scene)
        const list = await proof.read(scene, "accounting.entries", { q: "nguyen" })
        const [row, ...others] = rowsOf(list)
        expect(others).toEqual([])
        expect(row).toMatchObject({ kind: "income", amountVnd: ORDER_AMOUNT })
        expect(row).toHaveProperty("status")
        expect(row).toHaveProperty("counterparty")
        expect(row).not.toHaveProperty("sourceEntity")
        expect(row).not.toHaveProperty("sourceId")
        expect(String(row?.["note"])).toContain("NGUYEN VAN DINH")
        expect(await proof.read(scene, "accounting.entry-counts")).toMatchObject({ counts: { income: 1 } })
        expect(await proof.read(scene, "accounting.entry", { id: row?.["id"] })).toMatchObject({
            kind: "income",
            amountVnd: ORDER_AMOUNT,
            sourceEntity: "payment.transaction",
        })
        expect(await proof.read(scene, "accounting.figures")).toMatchObject({
            income: { vnd: ORDER_AMOUNT, count: 1 },
            receivable: { vnd: 2_000_000, count: 1 },
        })
    })

    it("records a correction through the door, and refuses a short note naming the field", async () => {
        const scene = await openScene()
        await settle(scene, scene.transactionId)
        await runBookProjections(scene)
        const listed = rowsOf(await proof.read(scene, "accounting.entries", {}))
        const invoiceEntry = listed.find((row) => row["kind"] === "income")
        assert(invoiceEntry !== undefined, "the payment entry was not projected")
        const entry = { row: { id: String(invoiceEntry["id"]) } }
        await expect(
            proof.act(scene, "accounting.adjust", {
                id: entry.row.id,
                note: "Discount agreed by phone",
                correctedAmount: 1_800_000,
            }),
        ).resolves.toMatchObject({ ok: true })
        const short = await proof.act(scene, "accounting.adjust", { id: entry.row.id, note: "ok" })
        expect(short).toMatchObject({ ok: false, reason: "invalid" })
        expect(refusedFieldsOf(short)).toEqual(["note"])
        expect((await jobNamesOf(scene)).filter((name) => name === BOOK_PROJECT)).toHaveLength(2)
    })
})
