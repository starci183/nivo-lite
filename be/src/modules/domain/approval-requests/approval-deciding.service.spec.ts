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
    HA,
    HA_REF,
    LAN,
    MINH,
    MINH_REF,
    NOW,
    OWNER,
    grantOf,
    requestOf,
    setupFor,
    setupOf,
    verdictOf,
} from "@tests/fixtures/builders/approval-requests.builder"
import type { Arrangement } from "@tests/fixtures/builders/approval-requests.builder"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalDecidingService } from "./approval-deciding.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import type { ApprovalResolved } from "./approval-requests.contracts"
import { ApprovalRequestsErrorCode } from "./errors/approval-requests.error"
import { INSERT_VERDICT, LIST_VERDICTS, LOCK_REQUEST, RESOLVE_REQUEST } from "./persistence/approval-requests.sql"

const EXPIRED: ApprovalResolved = {
    requestId: "request-1",
    outcome: "expired",
    decidedBy: null,
    decidedByName: null,
    action: "give_discount",
    workspaceId: "ws-1",
    chainStepId: "step-1",
    escalatedTo: MINH_REF,
}

const answer = (memberId: string, verdict: "approve" | "reject" = "approve") => ({
    requestId: "request-1",
    memberId,
    verdict,
})

const build = async (em: MockEntityManager, arrangement: Arrangement = {}) => {
    const transaction = fakeTransaction(em)
    const rules = mock<AuthorityRulesService>()
    rules.approvalSetup.mockResolvedValue(setupFor(arrangement))
    const grants = mock<MemberGrantsService>()
    grants.directory.mockResolvedValue(arrangement.directory ?? DIRECTORY)
    grants.forAction.mockResolvedValue(arrangement.grants ?? GRANTS)
    const escalation = mock<ApprovalEscalationService>()
    escalation.expire.mockResolvedValue(EXPIRED)
    const announcer = mock<ApprovalAnnouncerService>()
    announcer.resolved.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalDecidingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: MemberGrantsService, useValue: grants },
            { provide: ApprovalEscalationService, useValue: escalation },
            { provide: ApprovalAnnouncerService, useValue: announcer },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalDecidingService), transaction, escalation, announcer }
}

describe("ApprovalDecidingService > any one", () => {
    it("takes the lock first, then settles the request with the first approval and announces it", async () => {
        const em = mockEntityManager({
            query: [
                [LOCK_REQUEST, [requestOf()]],
                [LIST_VERDICTS, []],
                [INSERT_VERDICT, []],
                [RESOLVE_REQUEST, [{ id: "request-1" }]],
            ],
        })
        const { service, announcer, transaction } = await build(em)

        const progress = await service.decide(answer("member-minh"))

        expect(progress).toEqual({
            requestId: "request-1",
            status: "approved",
            approvedBy: ["member-minh"],
            remaining: [],
        })
        expect(em.query.mock.calls.map((call) => call[0])).toEqual([
            LOCK_REQUEST,
            LIST_VERDICTS,
            INSERT_VERDICT,
            RESOLVE_REQUEST,
        ])
        expect(String(LOCK_REQUEST)).toContain("FOR UPDATE")
        expect(announcer.resolved.mock.calls.map((call) => call[0])).toEqual([
            {
                requestId: "request-1",
                outcome: "approved",
                decidedBy: "member-minh",
                decidedByName: "Anh Minh",
                action: "give_discount",
                workspaceId: "ws-1",
                chainStepId: "step-1",
                escalatedTo: null,
            },
        ])
        expect(transaction.commits).toBe(1)
    })

    it("settles the request as rejected with a rejection", async () => {
        const { service, announcer } = await build(
            mockEntityManager({
                query: [
                    [LOCK_REQUEST, [requestOf()]],
                    [LIST_VERDICTS, []],
                    [INSERT_VERDICT, []],
                    [RESOLVE_REQUEST, [{ id: "request-1" }]],
                ],
            }),
        )

        await expect(service.decide(answer("member-minh", "reject"))).resolves.toMatchObject({
            status: "rejected",
            approvedBy: [],
        })
        expect(announcer.resolved.mock.calls[0]?.[0]).toMatchObject({ outcome: "rejected" })
    })
})

describe("ApprovalDecidingService > any one, a request settled before", () => {
    it.each([
        { status: "approved" as const, code: ApprovalRequestsErrorCode.AlreadyApproved },
        { status: "rejected" as const, code: ApprovalRequestsErrorCode.AlreadyRejected },
    ])("tells the one who came second who $status it and when, and writes nothing", async ({ status, code }) => {
        const settled = requestOf({ status, resolved_by: "member-minh", resolved_at: "2026-10-22T02:42:00.000Z" })
        const em = mockEntityManager({ query: [LOCK_REQUEST, [settled]] })
        const { service, announcer, transaction } = await build(em)

        await expect(service.decide(answer("member-ha"))).rejects.toMatchObject({
            code,
            params: { name: "Anh Minh", time: "09:42" },
        })

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(announcer.resolved).not.toHaveBeenCalled()
        expect(transaction.rollbacks).toBe(1)
    })

    it("tells a late answer that the request already ran out of time", async () => {
        const em = mockEntityManager({ query: [LOCK_REQUEST, [requestOf({ status: "expired", resolved_at: NOW })]] })
        const { service } = await build(em)

        await expect(service.decide(answer("member-minh"))).rejects.toMatchObject({
            code: ApprovalRequestsErrorCode.Expired,
        })
    })

    it("refuses a request that does not exist", async () => {
        const { service } = await build(mockEntityManager({ query: [LOCK_REQUEST, []] }))

        await expect(service.decide(answer("member-minh"))).rejects.toMatchObject({
            code: ApprovalRequestsErrorCode.NotFound,
        })
    })

    it("settles a request past its time as expired, commits that, announces it and refuses the answer", async () => {
        const late = requestOf({ expires_at: "2026-10-22T09:00:00.000Z" })
        const em = mockEntityManager({ query: [LOCK_REQUEST, [late]] })
        const { service, escalation, announcer, transaction } = await build(em)

        await expect(service.decide(answer("member-minh"))).rejects.toMatchObject({
            code: ApprovalRequestsErrorCode.Expired,
        })

        expect(transaction.commits).toBe(1)
        expect(escalation.expire).toHaveBeenCalledTimes(1)
        expect(announcer.resolved.mock.calls.map((call) => call[0])).toEqual([EXPIRED])
    })
})

describe("ApprovalDecidingService > who may answer", () => {
    it.each([
        { name: "a member outside the group", memberId: "member-owner", code: ApprovalRequestsErrorCode.NotInGroup },
        {
            name: "a member of the group with no grant",
            memberId: "member-lan",
            code: ApprovalRequestsErrorCode.NoGrant,
        },
        {
            name: "a member whose limit is below the amount",
            memberId: "member-ha",
            code: ApprovalRequestsErrorCode.OverLimit,
        },
        { name: "a stranger", memberId: "member-9", code: ApprovalRequestsErrorCode.NotInGroup },
    ])("refuses $name before anything is written", async ({ memberId, code }) => {
        const em = mockEntityManager({ query: [LOCK_REQUEST, [requestOf({ approvers: [MINH_REF, HA_REF] })]] })
        const { service, announcer, transaction } = await build(em)

        await expect(service.decide(answer(memberId))).rejects.toMatchObject({ code })

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(announcer.resolved).not.toHaveBeenCalled()
        expect(transaction.rollbacks).toBe(1)
    })

    it("refuses a member who was disabled after the request opened", async () => {
        const { service } = await build(
            mockEntityManager({ query: [LOCK_REQUEST, [requestOf({ approvers: [MINH_REF, HA_REF] })]] }),
            { directory: [OWNER, { ...MINH, status: "disabled" }, HA, LAN] },
        )

        await expect(service.decide(answer("member-minh"))).rejects.toMatchObject({
            code: ApprovalRequestsErrorCode.MemberInactive,
        })
    })

    it("refuses a member whose grant was revoked after the request opened, though the snapshot named them", async () => {
        const { service } = await build(
            mockEntityManager({ query: [LOCK_REQUEST, [requestOf({ approvers: [MINH_REF, HA_REF] })]] }),
            { grants: [] },
        )

        await expect(service.decide(answer("member-minh"))).rejects.toMatchObject({
            code: ApprovalRequestsErrorCode.NoGrant,
        })
    })
})

describe("ApprovalDecidingService > what changed since the request opened", () => {
    it("lets a member answer who was granted the right after it opened", async () => {
        const grants = [...GRANTS, grantOf({ id: "grant-9", member_id: "member-lan", max_amount: 50 })]
        const { service } = await build(
            mockEntityManager({
                query: [
                    [LOCK_REQUEST, [requestOf()]],
                    [LIST_VERDICTS, []],
                    [INSERT_VERDICT, []],
                    [RESOLVE_REQUEST, [{ id: "request-1" }]],
                ],
            }),
            { grants },
        )

        await expect(service.decide(answer("member-lan"))).resolves.toMatchObject({ status: "approved" })
    })

    it("falls back to the people the request named when the rule is gone", async () => {
        const { service } = await build(
            mockEntityManager({
                query: [
                    [LOCK_REQUEST, [requestOf()]],
                    [LIST_VERDICTS, []],
                    [INSERT_VERDICT, []],
                    [RESOLVE_REQUEST, [{ id: "request-1" }]],
                ],
            }),
            { setup: null },
        )

        await expect(service.decide(answer("member-minh"))).resolves.toMatchObject({ status: "approved" })
    })

    it("refuses everyone but the people the request named when the rule is gone", async () => {
        const { service } = await build(
            mockEntityManager({ query: [LOCK_REQUEST, [requestOf({ approvers: [MINH_REF, HA_REF] })]] }),
            { setup: null },
        )

        await expect(service.decide(answer("member-lan"))).rejects.toMatchObject({
            code: ApprovalRequestsErrorCode.NotInGroup,
        })
    })
})

describe("ApprovalDecidingService > all", () => {
    const grants = [grantOf(), grantOf({ id: "grant-3", member_id: "member-ha", max_amount: 50 })]
    const both = { policy: "all" as const, approvers: [MINH_REF, HA_REF] }

    it("keeps a request open until every approver approved, and tells who is still awaited", async () => {
        const em = mockEntityManager({
            query: [
                [LOCK_REQUEST, [requestOf(both)]],
                [LIST_VERDICTS, []],
                [INSERT_VERDICT, []],
            ],
        })
        const { service, announcer, transaction } = await build(em, { setup: setupOf({ policy: "all" }), grants })

        await expect(service.decide(answer("member-minh"))).resolves.toEqual({
            requestId: "request-1",
            status: "pending",
            approvedBy: ["member-minh"],
            remaining: [HA_REF],
        })

        expect(em.query.mock.calls.map((call) => call[0])).not.toContain(RESOLVE_REQUEST)
        expect(announcer.resolved).not.toHaveBeenCalled()
        expect(transaction.commits).toBe(1)
    })

    it("approves with the last approval and counts the earlier ones", async () => {
        const em = mockEntityManager({
            query: [
                [LOCK_REQUEST, [requestOf(both)]],
                [LIST_VERDICTS, [verdictOf()]],
                [INSERT_VERDICT, []],
                [RESOLVE_REQUEST, [{ id: "request-1" }]],
            ],
        })
        const { service } = await build(em, { setup: setupOf({ policy: "all" }), grants })

        await expect(service.decide(answer("member-ha"))).resolves.toEqual({
            requestId: "request-1",
            status: "approved",
            approvedBy: ["member-minh", "member-ha"],
            remaining: [],
        })
    })

    it("refuses a member who already answered", async () => {
        const em = mockEntityManager({
            query: [
                [LOCK_REQUEST, [requestOf(both)]],
                [LIST_VERDICTS, [verdictOf()]],
            ],
        })
        const { service, transaction } = await build(em, { setup: setupOf({ policy: "all" }), grants })

        await expect(service.decide(answer("member-minh"))).rejects.toMatchObject({
            code: ApprovalRequestsErrorCode.AlreadyDecided,
        })
        expect(transaction.rollbacks).toBe(1)
    })
})

describe("ApprovalDecidingService > in order", () => {
    const grants = [grantOf(), grantOf({ id: "grant-3", member_id: "member-ha", max_amount: 50 })]
    const named = { roles: [], rooms: [], members: ["member-minh", "member-ha"] }

    it("refuses the second approver before the first has answered, naming who is next", async () => {
        const em = mockEntityManager({
            query: [
                [LOCK_REQUEST, [requestOf({ policy: "sequential", approvers: [MINH_REF, HA_REF] })]],
                [LIST_VERDICTS, []],
            ],
        })
        const setup = setupOf({ policy: "sequential", group: named })
        const { service } = await build(em, { setup, grants })

        await expect(service.decide(answer("member-ha"))).rejects.toMatchObject({
            code: ApprovalRequestsErrorCode.NotYourTurn,
            params: { name: "Anh Minh" },
        })
    })

    it("passes the turn to the next approver after an approval", async () => {
        const em = mockEntityManager({
            query: [
                [LOCK_REQUEST, [requestOf({ policy: "sequential", approvers: [MINH_REF, HA_REF] })]],
                [LIST_VERDICTS, []],
                [INSERT_VERDICT, []],
            ],
        })
        const { service } = await build(em, { setup: setupOf({ policy: "sequential", group: named }), grants })

        await expect(service.decide(answer("member-minh"))).resolves.toMatchObject({
            status: "pending",
            remaining: [HA_REF],
        })
    })
})
