import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PaymentOrdersService } from "@modules/domain/payment-orders"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { Secret } from "@modules/platform/config"
import { PaymentOrderHistoryService } from "@modules/domain/payment-orders"
import { WorkspaceAdminReadService, WorkspaceBillingService } from "@modules/domain/workspaces"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import {
    annualPlan,
    customPlan,
    promoPlan,
    starterPlan,
    teamPlan,
    teamTier,
    unlistedPlan,
} from "@tests/fixtures/builders/plans.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BILLING_OPTIONS } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import { BillingService } from "./billing.service"
import { BillingErrorCode } from "./errors/billing.error"
import { PlanEntity, PlanUsageTierEntity } from "./persistence/entities"

const OPTIONS: BillingOptions = {
    sepayApiKey: new Secret("key"),
    bankAccount: { account: "0123", bank: "MB", holder: "NIVO" },
    channelTokenKey: undefined,
}
const ORDER: PaymentOrder = {
    id: "order-1",
    workspaceId: "ws-1",
    planCode: "starter",
    amountVnd: 990000,
    orderCode: "NIVO8F3K2",
    status: "pending",
    expiresAt: "2026-10-12T10:30:00.000Z",
    paidAt: null,
    createdAt: "2026-10-12T10:00:00.000Z",
    kind: "plan",
    packCode: null,
    detail: {},
}
const PAYABLE = {
    order: ORDER,
    qrUrl: "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2&template=compact",
    bank: OPTIONS.bankAccount,
}
const PLAN_DETAIL = {
    cycle: "monthly",
    months: 1,
    tierCredits: 0,
    seats: 1,
    promo: false,
    listMonthlyVnd: 990000,
}
const NO_TIER = { tier_credits: null, seat_count: null, billing_cycle: null, billed_monthly_vnd: null }
const WORKSPACE_ROW: BillingRow = { status: "active", plan_code: "starter", paid_until: null, ...NO_TIER }

/** The role of the caller's active seat each manager's workspace holds; none when the caller has no active seat. */
const ROLES = new WeakMap<MockEntityManager, string | null>()

/** The billing columns of a workspace in the shape of the scenarios, as the owner of the workspaces answers them. */
interface BillingRow {
    readonly status: string
    readonly plan_code: string | null
    readonly paid_until: string | null
    readonly tier_credits: number | null
    readonly seat_count: number | null
    readonly billing_cycle: "monthly" | "annual" | null
    readonly billed_monthly_vnd: number | null
}

const factsOf = (row: BillingRow) => ({
    status: row.status,
    planCode: row.plan_code,
    paidUntil: row.paid_until === null ? null : new Date(row.paid_until),
    tierCredits: row.tier_credits,
    seatCount: row.seat_count,
    billingCycle: row.billing_cycle,
    billedMonthlyVnd: row.billed_monthly_vnd,
})

/** The workspace row and the promo counts each manager's scenario holds. */
const WORKSPACES = new WeakMap<MockEntityManager, BillingRow | null>()
const PROMOS = new WeakMap<MockEntityManager, { full_price: number; promo: number } | undefined>()

const build = async (entityManager: MockEntityManager) => {
    const workspace = WORKSPACES.get(entityManager) ?? null
    const workspaceBilling = mock<WorkspaceBillingService>()
    workspaceBilling.factsOf.mockResolvedValue(workspace === null ? null : factsOf(workspace))
    const workspaceReads = mock<WorkspaceAdminReadService>()
    workspaceReads.namesOf.mockResolvedValue([{ id: "ws-1", name: "Shop" }])
    const history = mock<PaymentOrderHistoryService>()
    const promo = PROMOS.get(entityManager)
    history.planPaymentsOf.mockResolvedValue({ fullPrice: promo?.full_price ?? 0, promo: promo?.promo ?? 0 })
    const role = ROLES.get(entityManager) ?? null
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeSeatOfUser.mockResolvedValue(
        role === null
            ? null
            : {
                  memberId: "m-1",
                  userId: "person-1",
                  role: role as WorkspaceRole,
                  displayName: "Lan",
                  status: "active",
              },
    )
    const orders = mock<PaymentOrdersService>()
    orders.create.mockResolvedValue(ORDER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BillingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: PaymentOrdersService, useValue: orders },
            { provide: BILLING_OPTIONS, useValue: OPTIONS },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: WorkspaceBillingService, useValue: workspaceBilling },
            { provide: WorkspaceAdminReadService, useValue: workspaceReads },
            { provide: PaymentOrderHistoryService, useValue: history },
        ],
    }).compile()
    return { billing: moduleRef.get(BillingService), orders, seats, workspaceBilling, workspaceReads, history }
}

/** What the database holds for one scenario: a key present is read (the query builders answer in the order role, workspace, promo). */
interface World {
    /** The role of the caller's membership, or null when there is none. */
    readonly role?: string | null
    /** The billing columns of the workspace, or null when it is gone. */
    readonly workspace?: BillingRow | null
    /** The plan the code names, or null when none is active. */
    readonly plan?: PlanEntity | null
    /** The usage tiers of every plan. */
    readonly tiers?: ReadonlyArray<PlanUsageTierEntity>
    /** What the workspace already paid for plan months. */
    readonly promo?: { readonly full_price: number; readonly promo: number } | undefined
}

const NO_PROMO = { full_price: 0, promo: 0 }

const worldOf = (world: World) => {
    const em = mockEntityManager({
        findOne: [PlanEntity, world.plan ?? null],
        find: [PlanUsageTierEntity, world.tiers ?? []],
    })
    WORKSPACES.set(em, world.workspace ?? null)
    PROMOS.set(em, world.promo)
    if ("role" in world) ROLES.set(em, world.role ?? null)
    return em
}

/** The same membership read `times` times: one lookup per guard the subject runs. */
const membershipOf = (role: string | null) => {
    const em = mockEntityManager()
    ROLES.set(em, role)
    return em
}

/** A member who may pay and a workspace on the starter plan. */
const pricedWorld = (plan: PlanEntity = starterPlan()): World => ({
    role: "owner",
    workspace: WORKSPACE_ROW,
    plan,
    promo: NO_PROMO,
})

describe("BillingService", () => {
    it("answers the configured bank account", async () => {
        const { billing } = await build(mockEntityManager())

        await expect(billing.bankAccount()).resolves.toEqual(OPTIONS.bankAccount)
    })

    it("lists the active plans", async () => {
        const em = mockEntityManager({
            find: [
                [PlanEntity, [starterPlan()]],
                [PlanUsageTierEntity, []],
            ],
        })
        const { billing } = await build(em)

        await expect(billing.listPlans()).resolves.toMatchObject([{ code: "starter", priceVnd: 990000, listed: true }])
        expect(em.find).toHaveBeenCalledWith(PlanEntity, {
            where: { active: true, listed: true },
            order: { sort: "ASC" },
            take: 100,
        })
        expect(em.find).toHaveBeenCalledWith(PlanUsageTierEntity, {
            order: { planCode: "ASC", sort: "ASC" },
            take: 500,
        })
    })

    it("finds a plan, answers null for an unknown code and refuses to require it", async () => {
        const em = worldOf({ plan: starterPlan() })
        const { billing } = await build(em)
        const { billing: none } = await build(worldOf({ plan: null }))

        await expect(billing.findPlan("starter")).resolves.toMatchObject({ code: "starter" })
        await expect(billing.requirePlan("starter")).resolves.toMatchObject({ code: "starter" })
        await expect(none.findPlan("nope")).resolves.toBeNull()
        await expect(none.requirePlan("nope")).rejects.toMatchObject({
            code: BillingErrorCode.PlanNotFound,
            params: { plan: "nope" },
        })
        expect(em.findOne).toHaveBeenCalledWith(PlanEntity, { where: { code: "starter", active: true } })
    })

    it("reads the billing columns of a workspace or null", async () => {
        const row = {
            ...WORKSPACE_ROW,
            tier_credits: 3000,
            seat_count: 2,
            billing_cycle: "monthly" as const,
            billed_monthly_vnd: 990000,
        }
        const { billing } = await build(worldOf({ workspace: row }))
        const { billing: none } = await build(worldOf({ workspace: null }))

        await expect(billing.findWorkspaceBilling("ws-1")).resolves.toEqual({
            status: "active",
            planCode: "starter",
            paidUntil: null,
            tierCredits: 3000,
            seatCount: 2,
            billingCycle: "monthly",
            billedMonthlyVnd: 990000,
        })
        await expect(none.findWorkspaceBilling("ws-1")).resolves.toBeNull()
    })
})

describe("BillingService > membership", () => {
    it.each(["owner", "manager"])("lets an active %s manage and be a member", async (role) => {
        const em = membershipOf(role)
        const { billing, seats } = await build(em)

        await expect(billing.requireManager("person-1", "ws-1")).resolves.toBeUndefined()
        await expect(billing.requireMember("person-1", "ws-1")).resolves.toBeUndefined()
        expect(seats.activeSeatOfUser).toHaveBeenCalledTimes(2)
    })

    it("lets staff read but not manage", async () => {
        const { billing } = await build(membershipOf("staff"))

        await expect(billing.requireMember("person-1", "ws-1")).resolves.toBeUndefined()
        await expect(billing.requireManager("person-1", "ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.Forbidden,
        })
    })

    it("refuses a person who is not a member", async () => {
        const { billing } = await build(membershipOf(null))

        await expect(billing.requireMember("person-1", "ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.NotMember,
        })
        await expect(billing.requireManager("person-1", "ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.Forbidden,
        })
    })
})

describe("BillingService > renew", () => {
    it("counts no payments when the workspace has no paid plan order yet", async () => {
        const { billing, orders } = await build(worldOf({ ...pricedWorld(), promo: undefined }))

        await expect(billing.renew("person-1", { workspaceId: "ws-1" })).resolves.toEqual(PAYABLE)
        expect(orders.create).toHaveBeenCalledWith(expect.objectContaining({ planCode: "starter", amountVnd: 990000 }))
    })

    it("orders the current plan of the workspace at its price", async () => {
        const { billing, orders } = await build(worldOf(pricedWorld()))

        await expect(billing.renew("person-1", { workspaceId: "ws-1" })).resolves.toEqual(PAYABLE)
        expect(orders.create).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            userId: "person-1",
            planCode: "starter",
            amountVnd: 990000,
            kind: "plan",
            packCode: null,
            detail: PLAN_DETAIL,
        })
    })

    it("keeps the cycle and the seats the workspace already pays", async () => {
        const { billing, orders } = await build(
            worldOf({
                ...pricedWorld(annualPlan()),
                workspace: { ...WORKSPACE_ROW, seat_count: 4, billing_cycle: "annual" },
            }),
        )

        await expect(billing.renew("person-1", { workspaceId: "ws-1" })).resolves.toEqual(PAYABLE)
        expect(orders.create).toHaveBeenCalledWith(
            expect.objectContaining({
                amountVnd: 9900000,
                detail: { ...PLAN_DETAIL, cycle: "annual", months: 12 },
            }),
        )
    })
})

describe("BillingService > renew", () => {
    it("refuses a workspace that does not exist or has no plan yet", async () => {
        const missing = await build(worldOf({ role: "owner", workspace: null, plan: null }))
        const unpaid = await build(
            worldOf({
                role: "owner",
                workspace: { ...WORKSPACE_ROW, status: "pending_payment", plan_code: null },
                plan: null,
            }),
        )

        await expect(missing.billing.renew("person-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
            code: BillingErrorCode.WorkspaceNotFound,
        })
        await expect(unpaid.billing.renew("person-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
            code: BillingErrorCode.WorkspaceNotFound,
        })
    })

    it("refuses a contract plan and writes no order", async () => {
        const { billing, orders } = await build(worldOf(pricedWorld(customPlan())))

        await expect(billing.renew("person-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
            code: BillingErrorCode.PlanCustom,
        })
        expect(orders.create).not.toHaveBeenCalled()
    })

    it("refuses a caller who is not a manager before reading anything else", async () => {
        const em = worldOf({ role: null })
        const { billing } = await build(em)

        await expect(billing.renew("person-1", { workspaceId: "ws-1" })).rejects.toMatchObject({
            code: BillingErrorCode.Forbidden,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.findOne).not.toHaveBeenCalled()
    })
})

describe("BillingService > orderPlan", () => {
    it("orders the plan the workspace chose", async () => {
        const em = worldOf({ role: "manager", plan: starterPlan(), promo: NO_PROMO })
        const { billing, orders } = await build(em)

        await expect(billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "starter" })).resolves.toEqual(
            PAYABLE,
        )
        expect(orders.create).toHaveBeenCalledWith(
            expect.objectContaining({ planCode: "starter", amountVnd: 990000, detail: PLAN_DETAIL }),
        )
    })

    it("prices a per-seat plan from the level and the seats the caller picked", async () => {
        const { billing, orders } = await build(
            worldOf({ role: "manager", plan: teamPlan(), tiers: [teamTier()], promo: NO_PROMO }),
        )

        await billing.orderPlan("person-1", {
            workspaceId: "ws-1",
            planCode: "team",
            selection: { cycle: "monthly", tierCredits: 5000, seats: 2 },
        })

        expect(orders.create).toHaveBeenCalledWith(
            expect.objectContaining({
                planCode: "team",
                amountVnd: 400000,
                detail: {
                    cycle: "monthly",
                    months: 1,
                    tierCredits: 5000,
                    seats: 2,
                    promo: false,
                    listMonthlyVnd: 400000,
                },
            }),
        )
    })
})

describe("BillingService > orderPlan", () => {
    it.each([
        ["another plan", { ...WORKSPACE_ROW, plan_code: "growth" }],
        ["no workspace", null],
    ])("refuses an unlisted plan of %s", async (_label, workspace) => {
        const { billing, orders } = await build(worldOf({ role: "manager", plan: unlistedPlan(), workspace }))

        await expect(billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "starter" })).rejects.toMatchObject(
            { code: BillingErrorCode.PlanNotListed, params: { plan: "starter" } },
        )
        expect(orders.create).not.toHaveBeenCalled()
    })

    it("lets a workspace pay again for the unlisted plan it already has", async () => {
        const { billing, orders } = await build(
            worldOf({ role: "manager", plan: unlistedPlan(), workspace: WORKSPACE_ROW, promo: NO_PROMO }),
        )

        await expect(billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "starter" })).resolves.toEqual(
            PAYABLE,
        )
        expect(orders.create).toHaveBeenCalledWith(expect.objectContaining({ planCode: "starter" }))
    })

    it("refuses an unknown plan", async () => {
        const { billing } = await build(worldOf({ role: "manager", plan: null }))

        await expect(billing.orderPlan("person-1", { workspaceId: "ws-1", planCode: "nope" })).rejects.toMatchObject({
            code: BillingErrorCode.PlanNotFound,
        })
    })
})

describe("BillingService > workspaces", () => {
    const row = { ...WORKSPACE_ROW, paid_until: "2026-11-01T00:00:00.000Z" }

    it("lists the caller's active workspaces", async () => {
        const em = membershipOf("owner")
        WORKSPACES.set(em, row)
        const { billing, seats, workspaceReads } = await build(em)
        seats.activeSeatsOfUser.mockResolvedValue([{ workspaceId: "ws-1", role: "owner" }])

        await expect(billing.workspaces("person-1")).resolves.toEqual([
            {
                id: "ws-1",
                name: "Shop",
                role: "owner",
                status: "active",
                planCode: "starter",
                paidUntil: "2026-11-01T00:00:00.000Z",
                tierCredits: null,
                seatCount: null,
                billingCycle: null,
                billedMonthlyVnd: null,
            },
        ])
        expect(seats.activeSeatsOfUser).toHaveBeenCalledWith("person-1", 200)
        expect(workspaceReads.namesOf).toHaveBeenCalledWith(["ws-1"], 200)
    })

    it("leaves out a workspace that is gone or has no name", async () => {
        const { billing, seats } = await build(mockEntityManager())
        seats.activeSeatsOfUser.mockResolvedValue([{ workspaceId: "ws-1", role: "owner" }])

        await expect(billing.workspaces("person-1")).resolves.toEqual([])
    })

    it("lists nothing for a caller with no active seat", async () => {
        const em = mockEntityManager()
        const { billing, seats, workspaceBilling } = await build(em)
        seats.activeSeatsOfUser.mockResolvedValue([])

        await expect(billing.workspaces("person-1")).resolves.toEqual([])
        expect(workspaceBilling.factsOf).not.toHaveBeenCalled()
    })

    it("reads one workspace for a member and refuses anyone else", async () => {
        const member = membershipOf("owner")
        WORKSPACES.set(member, row)
        const outside = membershipOf(null)
        const { billing } = await build(member)
        const { billing: outsider } = await build(outside)

        await expect(billing.workspace("person-1", "ws-1")).resolves.toMatchObject({
            id: "ws-1",
            name: "Shop",
            role: "owner",
        })
        await expect(outsider.workspace("person-1", "ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.NotMember,
        })
    })

    it("refuses a member of a workspace that is gone", async () => {
        const { billing } = await build(membershipOf("owner"))

        await expect(billing.workspace("person-1", "ws-1")).rejects.toMatchObject({
            code: BillingErrorCode.NotMember,
        })
    })
})

describe("BillingService > quote", () => {
    it("prices the intro offer while the workspace has not paid full price", async () => {
        const { billing } = await build(worldOf({ role: "staff", plan: promoPlan(), promo: NO_PROMO }))

        await expect(billing.quote("person-1", { workspaceId: "ws-1", planCode: "starter" })).resolves.toEqual({
            planCode: "starter",
            cycle: "monthly",
            months: 1,
            amountVnd: 490000,
            listMonthlyVnd: 990000,
            promo: true,
            tierCredits: null,
            seats: 1,
            creditsPerMonth: 3000,
        })
    })

    it("stops at membership and reads nothing else", async () => {
        const em = worldOf({ role: null })
        const { billing } = await build(em)

        await expect(billing.quote("person-1", { workspaceId: "ws-1", planCode: "starter" })).rejects.toMatchObject({
            code: BillingErrorCode.NotMember,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.findOne).not.toHaveBeenCalled()
    })
})
