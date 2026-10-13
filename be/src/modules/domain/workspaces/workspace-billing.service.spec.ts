import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import {
    FIND_ACTIVE_PLAN,
    FIND_BILLING,
    UPDATE_PAID_UNTIL,
    UPDATE_PLAN,
    UPDATE_STATUS,
} from "./persistence/workspace-billing.sql"
import { WorkspaceBillingService } from "./workspace-billing.service"

const NOW = new Date("2026-10-12T00:00:00.000Z")
const BILLING = [{ paid_until: "2026-12-01T00:00:00.000Z", status: "active", plan_code: "starter" }]

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
                query: [
                    [FIND_BILLING, BILLING],
                    [UPDATE_PAID_UNTIL, []],
                ],
            })

            await expect((await build(em)).extend("ws-1", 10)).resolves.toEqual({
                from: "2026-12-01T00:00:00.000Z",
                to: "2026-12-11T00:00:00.000Z",
            })
            expect(em.query).toHaveBeenCalledWith(UPDATE_PAID_UNTIL, ["ws-1", "2026-12-11T00:00:00.000Z"])
        })

        it("counts from now for a workspace that never paid", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_BILLING, [{ paid_until: null, status: "pending_payment", plan_code: null }]],
                    [UPDATE_PAID_UNTIL, []],
                ],
            })

            await expect((await build(em)).extend("ws-1", 1)).resolves.toEqual({
                from: null,
                to: "2026-10-13T00:00:00.000Z",
            })
        })

        it("answers not found for a workspace that does not exist and writes nothing", async () => {
            const em = mockEntityManager({ query: [FIND_BILLING, []] })

            await expect((await build(em)).extend("ws-9", 1)).rejects.toMatchObject({
                code: WorkspacesErrorCode.NotFound,
            })
            expect(em.query).not.toHaveBeenCalledWith(UPDATE_PAID_UNTIL, expect.anything())
        })
    })

    describe("setStatus", () => {
        it("sets the status and answers from and to", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_BILLING, BILLING],
                    [UPDATE_STATUS, []],
                ],
            })

            await expect((await build(em)).setStatus("ws-1", "past_due")).resolves.toEqual({
                from: "active",
                to: "past_due",
            })
            expect(em.query).toHaveBeenCalledWith(UPDATE_STATUS, ["ws-1", "past_due"])
        })
    })

    describe("setPlan", () => {
        it("moves the workspace to an active plan", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_ACTIVE_PLAN, [{ code: "enterprise" }]],
                    [FIND_BILLING, BILLING],
                    [UPDATE_PLAN, []],
                ],
            })

            await expect((await build(em)).setPlan("ws-1", "enterprise")).resolves.toEqual({
                from: "starter",
                to: "enterprise",
            })
            expect(em.query).toHaveBeenCalledWith(UPDATE_PLAN, ["ws-1", "enterprise"])
        })

        it("refuses an unknown or retired plan and changes nothing", async () => {
            const em = mockEntityManager({ query: [FIND_ACTIVE_PLAN, []] })

            await expect((await build(em)).setPlan("ws-1", "gone")).rejects.toMatchObject({
                code: WorkspacesErrorCode.PlanUnknown,
            })
            expect(em.query).not.toHaveBeenCalledWith(UPDATE_PLAN, expect.anything())
        })
    })
})
