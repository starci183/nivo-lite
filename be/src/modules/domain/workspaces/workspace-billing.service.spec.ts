import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { WorkspaceRow } from "@tests/fixtures/builders/workspaces.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import { WorkspaceBillingService } from "./workspace-billing.service"

const NOW = new Date("2026-10-12T00:00:00.000Z")

/** The stored billing facts of a workspace. */
const billingOf = (patch: Partial<WorkspaceRow> = {}): WorkspaceEntity =>
    Object.assign(new WorkspaceEntity(), {
        paidUntil: new Date("2026-12-01T00:00:00.000Z"),
        status: "active",
        planCode: "starter",
        ...patch,
    })

const UPDATED = { affected: 1, raw: [], generatedMaps: [] }

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceBillingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return moduleRef.get(WorkspaceBillingService)
}

describe("WorkspaceBillingService", () => {
    describe("extend", () => {
        it("adds the days to the current end and answers from and to", async () => {
            const em = mockEntityManager({
                findOne: [WorkspaceEntity, billingOf()],
                update: [WorkspaceEntity, UPDATED],
            })

            await expect((await build(em)).extend("ws-1", 10)).resolves.toEqual({
                from: "2026-12-01T00:00:00.000Z",
                to: "2026-12-11T00:00:00.000Z",
            })
            expect(em.findOne).toHaveBeenCalledWith(WorkspaceEntity, {
                select: { paidUntil: true, status: true, planCode: true },
                where: { id: "ws-1" },
            })
            expect(em.update).toHaveBeenCalledWith(
                WorkspaceEntity,
                { id: "ws-1" },
                { paidUntil: new Date("2026-12-11T00:00:00.000Z") },
            )
        })

        it("counts from now for a workspace that never paid", async () => {
            const em = mockEntityManager({
                findOne: [WorkspaceEntity, billingOf({ paidUntil: null, status: "pending_payment", planCode: null })],
                update: [WorkspaceEntity, UPDATED],
            })

            await expect((await build(em)).extend("ws-1", 1)).resolves.toEqual({
                from: null,
                to: "2026-10-13T00:00:00.000Z",
            })
        })

        it("answers not found for a workspace that does not exist and writes nothing", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceEntity, null] })

            await expect((await build(em)).extend("ws-9", 1)).rejects.toMatchObject({
                code: WorkspacesErrorCode.NotFound,
            })
            expect(em.update).not.toHaveBeenCalled()
        })
    })

    describe("setStatus", () => {
        it("sets the status and answers from and to", async () => {
            const em = mockEntityManager({
                findOne: [WorkspaceEntity, billingOf()],
                update: [WorkspaceEntity, UPDATED],
            })

            await expect((await build(em)).setStatus("ws-1", "past_due")).resolves.toEqual({
                from: "active",
                to: "past_due",
            })
            expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-1" }, { status: "past_due" })
        })
    })
})

describe("WorkspaceBillingService", () => {
    describe("setPlan", () => {
        it("moves the workspace to an active plan and drops the tier and seats bought on the old one", async () => {
            const em = mockEntityManager({
                findOne: [WorkspaceEntity, billingOf()],
                update: [WorkspaceEntity, UPDATED],
            })

            await expect((await build(em)).setPlan("ws-1", { code: "enterprise" })).resolves.toEqual({
                from: "starter",
                to: "enterprise",
            })
            expect(em.update).toHaveBeenCalledWith(
                WorkspaceEntity,
                { id: "ws-1" },
                { planCode: "enterprise", tierCredits: null, seatCount: null },
            )
        })

        it("refuses an unknown or retired plan and changes nothing", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).setPlan("ws-1", null)).rejects.toMatchObject({
                code: WorkspacesErrorCode.PlanUnknown,
            })
            expect(em.update).not.toHaveBeenCalled()
        })
    })

    describe("factsOf", () => {
        it("answers the billing columns with the money columns as numbers", async () => {
            const stored = billingOf({
                tierCredits: "5000",
                billedMonthlyVnd: "299000",
                seatCount: 3,
                billingCycle: "annual",
            })
            const em = mockEntityManager({ findOne: [WorkspaceEntity, stored] })

            await expect((await build(em)).factsOf("ws-1")).resolves.toEqual({
                status: "active",
                planCode: "starter",
                paidUntil: new Date("2026-12-01T00:00:00.000Z"),
                tierCredits: 5000,
                seatCount: 3,
                billingCycle: "annual",
                billedMonthlyVnd: 299000,
            })
        })

        it("keeps the columns that were never set as none", async () => {
            const stored = billingOf({ tierCredits: null, billedMonthlyVnd: null, seatCount: null, billingCycle: null })
            const em = mockEntityManager({ findOne: [WorkspaceEntity, stored] })

            await expect((await build(em)).factsOf("ws-1")).resolves.toMatchObject({
                tierCredits: null,
                billedMonthlyVnd: null,
                seatCount: null,
                billingCycle: null,
            })
        })

        it("answers none for a workspace that does not exist", async () => {
            const em = mockEntityManager({ findOne: [WorkspaceEntity, null] })

            await expect((await build(em)).factsOf("ws-9")).resolves.toBeNull()
        })
    })
})
