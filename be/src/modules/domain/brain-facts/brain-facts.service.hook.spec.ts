import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { deriveFactOf } from "@tests/fixtures/builders/policy-derive.builder"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService, type FactsChangedHook } from "./brain-facts.service"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { InForceBoundService } from "./in-force-bound.service"

const WS = "ws-1"
const FACT = deriveFactOf({ id: "fee" })

/** The facts store with its writes scripted: this spec is about WHEN the listener is told, not what a write stores. */
const build = async () => {
    const em = mockEntityManager()
    const maintenance = mock<BrainFactsMaintenanceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-11-11T10:00:00.000Z") },
            { provide: BrainFactsReadService, useValue: mock<BrainFactsReadService>() },
            { provide: BrainFactsMaintenanceService, useValue: maintenance },
            { provide: BrainFactRelationsService, useValue: mock<BrainFactRelationsService>() },
            { provide: InForceBoundService, useValue: mock<InForceBoundService>() },
        ],
    }).compile()
    const service = moduleRef.get(BrainFactsService)
    const hook = mock<FactsChangedHook>()
    hook.factsChanged.mockResolvedValue(undefined)
    return { service, em, maintenance, hook }
}

describe("BrainFactsService.whenChanged (the one announcement of a change of what is in force)", () => {
    it("apply tells the listener once, after its transaction ended", async () => {
        const { service, em, hook } = await build()
        const order: Array<string> = []
        em.transaction.mockImplementation(() => {
            order.push("write")
            return Promise.resolve(FACT)
        })
        hook.factsChanged.mockImplementation(() => {
            order.push("told")
            return Promise.resolve()
        })
        service.whenChanged(hook)

        await expect(service.apply(WS, "fee", "Ada")).resolves.toBe(FACT)

        expect(order).toEqual(["write", "told"])
        expect(hook.factsChanged).toHaveBeenCalledWith(WS, ["fee"])
    })

    it("a write that fails tells nobody", async () => {
        const { service, em, hook } = await build()
        em.transaction.mockRejectedValue(new BrainFactsError({ code: BrainFactsErrorCode.NotProposed }))
        service.whenChanged(hook)

        await expect(service.apply(WS, "fee", "Ada")).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotProposed,
        })
        expect(hook.factsChanged).not.toHaveBeenCalled()
    })

    it("setReach tells the listener (the next version of the same truth)", async () => {
        const { service, em, hook } = await build()
        em.transaction.mockResolvedValue(FACT)
        service.whenChanged(hook)

        await service.setReach(WS, "fee", { scope: "public", modules: [] }, "Ada")

        expect(hook.factsChanged).toHaveBeenCalledTimes(1)
    })

    it("retire tells the listener", async () => {
        const { em, service, hook } = await build()
        queueQueryBuilders(em, [{ execute: { raw: [facts.rowOf({ id: "fee", status: "expired" })] } }])
        service.whenChanged(hook)

        await expect(service.retire(WS, "fee", "Ada")).resolves.toEqual(facts.factOf({ id: "fee", status: "expired" }))

        expect(hook.factsChanged).toHaveBeenCalledWith(WS, ["fee"])
    })

    it("maintain tells the listener only when a value took over or expired", async () => {
        const { service, maintenance, hook } = await build()
        service.whenChanged(hook)

        maintenance.maintain.mockResolvedValue({ activated: [], expired: 0 })
        await service.maintain(WS)
        expect(hook.factsChanged).not.toHaveBeenCalled()

        maintenance.maintain.mockResolvedValue({ activated: [FACT], expired: 0 })
        await service.maintain(WS)
        maintenance.maintain.mockResolvedValue({ activated: [], expired: 2 })
        await service.maintain(WS)
        expect(hook.factsChanged).toHaveBeenCalledTimes(2)
        // The values that took over are named (their vectors); an expiry names none (nothing to embed, the policy layer still re-derives).
        expect(hook.factsChanged.mock.calls).toEqual([
            [WS, ["fee"]],
            [WS, []],
        ])
    })

})

describe("BrainFactsService.whenChanged: listeners that fail and listeners that repeat", () => {
    it("a listener that throws never fails the write", async () => {
        const { service, em, hook } = await build()
        em.transaction.mockResolvedValue(FACT)
        hook.factsChanged.mockRejectedValue(new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound }))
        service.whenChanged(hook)

        await expect(service.apply(WS, "fee", "Ada")).resolves.toBe(FACT)
    })

    it("with no listener (an app without the brain module) a write is as before", async () => {
        const { service, em } = await build()
        em.transaction.mockResolvedValue(FACT)

        await expect(service.apply(WS, "fee", "Ada")).resolves.toBe(FACT)
    })

    it("tells every listener in turn (the policy layer and the fact vectors), even after one failed", async () => {
        const { service, em, hook } = await build()
        const vectors = {
            factsChanged: jest.fn<Promise<void>, [string, ReadonlyArray<string>]>().mockResolvedValue(undefined),
        }
        em.transaction.mockResolvedValue(FACT)
        hook.factsChanged.mockRejectedValue(new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound }))
        service.whenChanged(hook)
        service.whenChanged(vectors)

        await expect(service.apply(WS, "fee", "Ada")).resolves.toBe(FACT)

        expect(hook.factsChanged).toHaveBeenCalledWith(WS, ["fee"])
        expect(vectors.factsChanged).toHaveBeenCalledWith(WS, ["fee"])
    })

    it("a listener that throws before it answers a promise never fails the write nor the next listener", async () => {
        const { service, em } = await build()
        const broken = {
            factsChanged: (): Promise<void> => {
                throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
            },
        }
        const next = {
            factsChanged: jest.fn<Promise<void>, [string, ReadonlyArray<string>]>().mockResolvedValue(undefined),
        }
        em.transaction.mockResolvedValue(FACT)
        service.whenChanged(broken)
        service.whenChanged(next)

        await expect(service.setReach(WS, "fee", { scope: "public", modules: [] }, "Ada")).resolves.toBe(FACT)
        expect(next.factsChanged).toHaveBeenCalledTimes(1)
    })

    it("the same listener registered twice is told once", async () => {
        const { service, em, hook } = await build()
        em.transaction.mockResolvedValue(FACT)
        service.whenChanged(hook)
        service.whenChanged(hook)

        await service.apply(WS, "fee", "Ada")

        expect(hook.factsChanged).toHaveBeenCalledTimes(1)
    })
})

describe("BrainFactsService.announceChanged (one announcement for a batch)", () => {
    it("applyUnannounced tells nobody; announceChanged then tells each listener ONCE with every id (a bulk apply of N facts)", async () => {
        const { service, em, hook } = await build()
        em.transaction.mockResolvedValue(FACT)
        service.whenChanged(hook)

        const ids = Array.from({ length: 2000 }, (_, index) => `f${String(index)}`)
        for (const id of ids.slice(0, 3)) await service.applyUnannounced(WS, id, "Ada", "bulk:b-1")
        expect(hook.factsChanged).not.toHaveBeenCalled()

        await service.announceChanged(WS, [...ids, "f0"])
        expect(hook.factsChanged).toHaveBeenCalledTimes(1)
        expect(hook.factsChanged.mock.calls[0]?.[1]).toHaveLength(2000)

        await service.announceChanged(WS, [])
        expect(hook.factsChanged).toHaveBeenCalledTimes(1)
    })
})
