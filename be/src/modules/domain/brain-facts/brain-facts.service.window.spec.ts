/**
 * BRAIN-LIMITS item 5: the validity window alone can be edited. The same value with a NEW end (or a later start) is a change, the next
 * version, never "reinforced"; the same value with the same window still only grows the evidence.
 */
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { InForceBoundService } from "./in-force-bound.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { windowEndsBeforeStart, windowMovedOf } from "./fact-window.policy"
import { BrainFactEntity } from "./persistence/entities"

const END = "2027-10-12T10:00:00.000Z"
const NEW_END = "2026-12-31T00:00:00.000Z"
const LATER = "2026-11-01T00:00:00.000Z"

const build = async (em: MockEntityManager): Promise<BrainFactsService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
            InForceBoundService,
            BrainFactsReadService,
            BrainFactsMaintenanceService,
            { provide: BrainFactRelationsService, useValue: mock<BrainFactRelationsService>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return moduleRef.get(BrainFactsService)
}

/** A key holding the active value "8h" ending at END, and no waiting proposal. */
const withActive = async () => {
    const active = facts.rowOf({ status: "active", trust: 95, validTo: new Date(END) })
    const em = mockEntityManager({
        find: [
            [BrainFactEntity, [active]],
            [BrainFactEntity, []],
        ],
        update: [BrainFactEntity, { affected: 0 }],
    })
    const [write] = queueQueryBuilders(em, [{ execute: { raw: [facts.rowOf()] } }])
    return { em, write, service: await build(em) }
}

describe("windowMovedOf / windowEndsBeforeStart", () => {
    const stored = { validFrom: "2026-10-01T00:00:00.000Z", validTo: END }
    const now = Date.parse(facts.AT)

    it("a new end or a later start moves the window; the same end, no end stated, or a start in the past does not", () => {
        expect(windowMovedOf(stored, { validTo: NEW_END }, now)).toBe(true)
        expect(windowMovedOf({ ...stored, validTo: null }, { validTo: NEW_END }, now)).toBe(true)
        expect(windowMovedOf(stored, { validFrom: LATER }, now)).toBe(true)
        expect(windowMovedOf(stored, { validTo: END }, now)).toBe(false)
        expect(windowMovedOf(stored, {}, now)).toBe(false)
        expect(windowMovedOf(stored, { validFrom: "2026-01-01T00:00:00.000Z" }, now)).toBe(false)
    })

    it("a window that ends before (or when) it starts", () => {
        expect(windowEndsBeforeStart(LATER, "2026-10-20T00:00:00.000Z")).toBe(true)
        expect(windowEndsBeforeStart(LATER, LATER)).toBe(true)
        expect(windowEndsBeforeStart(LATER, NEW_END)).toBe(false)
        expect(windowEndsBeforeStart(undefined, NEW_END)).toBe(false)
        expect(windowEndsBeforeStart(LATER, null)).toBe(false)
    })
})

describe("BrainFactsService.propose: the validity window alone is a change", () => {
    it("the same value with the same window (or none stated) is reinforced: no new row", async () => {
        const { service, write } = await withActive()
        const result = await service.propose(facts.WS, facts.inputOf({ validTo: END }))
        expect(result.outcome).toBe("reinforced")
        // The one write is the evidence growth of the active row, never an insert.
        expect(write?.callsOf("insert") ?? []).toEqual([])
    })

    it("the same value with a NEW end files the next version against the value in force (a staff source: a proposal)", async () => {
        const { service, write } = await withActive()
        const result = await service.propose(facts.WS, facts.inputOf({ validTo: NEW_END }))
        expect(result.outcome).toBe("conflict")
        expect(result.created).toBe(true)
        expect(write?.callsOf("insert")).toHaveLength(1)
    })

    it("the founder's same value with a new end is applied at once as the next version", async () => {
        const { service } = await withActive()
        const apply = jest
            .spyOn(service, "apply")
            .mockResolvedValue(facts.factOf({ status: "active", validTo: NEW_END }))
        const result = await service.propose(
            facts.WS,
            facts.inputOf({ validTo: NEW_END, sourceKind: "owner", autoApply: true }),
        )
        expect(result).toMatchObject({ outcome: "applied", created: true })
        expect(apply).toHaveBeenCalledTimes(1)
    })
})

describe("BrainFactsService.split (BRAIN-LIMITS item 6): the founder's split is the approval, a manager's is a proposal", () => {
    const splitWith = async (inForce: boolean | undefined) => {
        const service = await build(mockEntityManager())
        jest.spyOn(service, "get").mockResolvedValue(facts.factOf())
        const propose = jest
            .spyOn(service, "propose")
            .mockResolvedValue({
                fact: facts.factOf({ id: "new", status: inForce === false ? "proposed" : "active" }),
                outcome: "applied",
            })
        const reject = jest.spyOn(service, "reject").mockResolvedValue(facts.factOf({ status: "rejected" }))
        const fact =
            inForce === undefined
                ? await service.split(facts.WS, "f1", "Weekend", "u2")
                : await service.split(facts.WS, "f1", "Weekend", "u2", inForce)
        return { fact, propose, reject }
    }

    it("by default (and with inForce) the situational value is applied at once", async () => {
        for (const flag of [undefined, true]) {
            const { propose } = await splitWith(flag)
            expect(propose).toHaveBeenCalledWith(facts.WS, facts.splitProposal)
        }
    })

    it("without inForce it is filed as a waiting proposal (no auto-apply); the original proposal is still turned down", async () => {
        const { fact, propose, reject } = await splitWith(false)
        expect(propose).toHaveBeenCalledWith(facts.WS, { ...facts.splitProposal, autoApply: false })
        expect(fact.status).toBe("proposed")
        expect(reject).toHaveBeenCalledWith(facts.WS, "f1", "u2", "Split into its own fact: Hours (Weekend)")
    })
})
