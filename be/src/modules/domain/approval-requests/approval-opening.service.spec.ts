import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    DIRECTORY,
    GRANTS,
    HA_REF,
    IN_30_MINUTES,
    MINH,
    MINH_REF,
    NOW,
    OWNER,
    OWNER_REF,
    openOf,
    approvalRequestOf,
    setupFor,
    setupOf,
} from "@tests/fixtures/builders/approval-requests.builder"
import type { Arrangement } from "@tests/fixtures/builders/approval-requests.builder"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import { ApprovalOpeningService } from "./approval-opening.service"
import type { ApprovalResolved } from "./approval-requests.contracts"
import { ApprovalRequestsErrorCode } from "./errors/approval-requests.error"
import { FIND_PENDING_REQUEST, INSERT_REQUEST } from "./persistence/approval-requests.sql"

const EXPIRED_AT_ONCE: ApprovalResolved = {
    requestId: "request-1",
    outcome: "expired",
    decidedBy: null,
    decidedByName: null,
    action: "give_discount",
    workspaceId: "ws-1",
    chainStepId: "step-1",
    escalatedTo: MINH_REF,
}

const build = async (em: MockEntityManager, arrangement: Arrangement = {}) => {
    const transaction = fakeTransaction(em)
    const rules = mock<AuthorityRulesService>()
    rules.approvalSetup.mockResolvedValue(setupFor(arrangement))
    const grants = mock<MemberGrantsService>()
    grants.directory.mockResolvedValue(arrangement.directory ?? DIRECTORY)
    grants.forAction.mockResolvedValue(arrangement.grants ?? GRANTS)
    const escalation = mock<ApprovalEscalationService>()
    escalation.expire.mockResolvedValue(EXPIRED_AT_ONCE)
    const announcer = mock<ApprovalAnnouncerService>()
    announcer.resolved.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalOpeningService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: MemberGrantsService, useValue: grants },
            { provide: ApprovalEscalationService, useValue: escalation },
            { provide: ApprovalAnnouncerService, useValue: announcer },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalOpeningService), transaction, escalation, announcer }
}

describe("ApprovalOpeningService > open", () => {
    it("tags the group the grants cover, lists who was left out and starts the clock", async () => {
        const em = mockEntityManager({ query: [INSERT_REQUEST, [approvalRequestOf({ approvers: [MINH_REF] })]] })
        const { service, transaction } = await build(em)

        const opened = await service.open(openOf())

        expect(opened).toEqual({
            requestId: "request-1",
            approvers: [MINH_REF],
            excluded: [],
            policy: "any",
            expiresAt: IN_30_MINUTES,
        })
        expect(transaction.commits).toBe(1)
        const params = em.query.mock.calls[0]?.[1]
        expect(params?.[8]).toBe(JSON.stringify([MINH_REF]))
        expect(params?.[9]).toBe(
            JSON.stringify([
                { memberId: "member-ha", reason: "over_limit" },
                { memberId: "member-lan", reason: "no_grant" },
            ]),
        )
        expect(params?.[11]).toBe(IN_30_MINUTES)
    })

    it("gives the approvers the order the rule lists them and the policy and time the rule names", async () => {
        const em = mockEntityManager({ query: [INSERT_REQUEST, [approvalRequestOf({ policy: "sequential" })]] })
        const setup = setupOf({
            policy: "sequential",
            timeout_minutes: 45,
            group: { roles: ["owner"], rooms: [], members: ["member-minh", "member-owner"] },
        })
        const { service } = await build(em, { setup })

        await service.open(openOf())

        const params = em.query.mock.calls[0]?.[1]
        expect(params?.[7]).toBe("sequential")
        expect(params?.[8]).toBe(JSON.stringify([MINH_REF, OWNER_REF]))
        expect(params?.[10]).toBe(45)
        expect(params?.[11]).toBe("2026-10-22T10:15:00.000Z")
    })

    it("opens a request for an action that carries no amount, covered by any grant", async () => {
        const em = mockEntityManager({ query: [INSERT_REQUEST, [approvalRequestOf({ amount: null })]] })
        const { service } = await build(em)

        await service.open(openOf({ amount: null }))

        const params = em.query.mock.calls[0]?.[1]
        expect(params?.[4]).toBeNull()
        expect(params?.[8]).toBe(JSON.stringify([MINH_REF, HA_REF]))
    })
})

describe("ApprovalOpeningService > open, a step that has a request", () => {
    it("answers the pending request of the step again instead of opening a second one", async () => {
        const pending = approvalRequestOf({
            approvers: [MINH_REF, HA_REF],
            excluded: [{ memberId: "member-lan", reason: "no_grant" }],
        })
        const em = mockEntityManager({
            query: [
                [INSERT_REQUEST, []],
                [FIND_PENDING_REQUEST, [pending]],
            ],
        })
        const { service, announcer } = await build(em)

        await expect(service.open(openOf())).resolves.toEqual({
            requestId: "request-1",
            approvers: [MINH_REF, HA_REF],
            excluded: [{ memberId: "member-lan", reason: "no_grant" }],
            policy: "any",
            expiresAt: IN_30_MINUTES,
        })
        expect(announcer.resolved).not.toHaveBeenCalled()
    })

    it("fails when the pending request vanished between the insert and the read", async () => {
        const em = mockEntityManager({
            query: [
                [INSERT_REQUEST, []],
                [FIND_PENDING_REQUEST, []],
            ],
        })
        const { service } = await build(em)

        await expect(service.open(openOf())).rejects.toMatchObject({ code: ApprovalRequestsErrorCode.NotFound })
    })
})

describe("ApprovalOpeningService > open, nobody can approve", () => {
    it("expires the request at once, hands it over and announces it", async () => {
        const em = mockEntityManager({
            query: [INSERT_REQUEST, [approvalRequestOf({ approvers: [], expires_at: NOW })]],
        })
        const { service, escalation, announcer } = await build(em, { directory: [OWNER, MINH], grants: [] })

        const opened = await service.open(openOf())

        expect(opened).toMatchObject({ approvers: [], expiresAt: NOW })
        expect(escalation.expire).toHaveBeenCalledTimes(1)
        expect(announcer.resolved).toHaveBeenCalledWith(EXPIRED_AT_ONCE)
        expect(em.query.mock.calls[0]?.[1]?.[11]).toBe(NOW)
    })
})

describe("ApprovalOpeningService > open, refusals", () => {
    it.each([
        { name: "an action with no rule", setup: null, params: {}, code: ApprovalRequestsErrorCode.NoRule },
        {
            name: "a rule that is never",
            setup: setupOf({ mode: "never" }),
            params: {},
            code: ApprovalRequestsErrorCode.NotApprovable,
        },
        {
            name: "an amount above the ask band",
            setup: setupOf(),
            params: { amount: 21 },
            code: ApprovalRequestsErrorCode.NotApprovable,
        },
        {
            name: "an agent the rule does not cover",
            setup: setupOf({ agents: ["33333333-3333-4333-8333-333333333333"] }),
            params: {},
            code: ApprovalRequestsErrorCode.AgentNotCovered,
        },
        {
            name: "a unit that is not the unit of the rule",
            setup: setupOf(),
            params: { unit: "vnd" as const },
            code: ApprovalRequestsErrorCode.UnitMismatch,
        },
        {
            name: "a negative amount",
            setup: setupOf(),
            params: { amount: -1 },
            code: ApprovalRequestsErrorCode.InvalidAmount,
        },
        {
            name: "an amount that is not a number",
            setup: setupOf(),
            params: { amount: Number.NaN },
            code: ApprovalRequestsErrorCode.InvalidAmount,
        },
    ])("refuses $name and writes nothing", async ({ setup, params, code }) => {
        const em = mockEntityManager()
        const { service, transaction } = await build(em, { setup })

        await expect(service.open(openOf(params))).rejects.toMatchObject({ code })

        expect(em.query).not.toHaveBeenCalled()
        expect(transaction.commits).toBe(0)
    })
})
