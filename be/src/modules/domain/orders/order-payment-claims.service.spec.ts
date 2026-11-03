import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, LessThanOrEqual } from "typeorm"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OrderPaymentClaimsService } from "./order-payment-claims.service"
import type { NewPaymentClaim } from "./orders.contracts"
import { PaymentClaimEntity } from "./persistence/entities"

const claim: NewPaymentClaim = {
    workspaceId: "ws-1",
    leadId: "lead-1",
    conversationId: "conv-1",
    amountVnd: 5000,
    names: ["BUI NGUYEN DINH"],
    body: "Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH",
    dedupeKey: "zalo:1:order-claim",
}

const entityOf = (patch: Partial<PaymentClaimEntity> = {}): PaymentClaimEntity =>
    Object.assign(new PaymentClaimEntity(), {
        id: "claim-1",
        workspaceId: "ws-1",
        leadId: "lead-1",
        conversationId: "conv-1",
        amountVnd: 5000,
        names: ["BUI NGUYEN DINH"],
        body: claim.body,
        claimedAt: new Date("2026-11-04T00:54:00.000Z"),
        status: "open",
        settledTransactionId: null,
        dedupeKey: "zalo:1:order-claim",
        ...patch,
    })

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OrderPaymentClaimsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(OrderPaymentClaimsService)
}

describe("OrderPaymentClaimsService", () => {
    it("writes a claim and answers its id; the same message again answers the id already written", async () => {
        const em = mockEntityManager({ findOneOrFail: [PaymentClaimEntity, entityOf()] })
        const first = fakeQueryBuilder({ execute: { raw: [{ id: "claim-new" }] } })
        const repeat = fakeQueryBuilder({ execute: { raw: [] } })
        answerQueryBuilders(em, first, repeat)
        const claims = await build(em)

        await expect(claims.record(claim)).resolves.toBe("claim-new")
        await expect(claims.record(claim)).resolves.toBe("claim-1")

        expect(first.callsOf("values")).toEqual([[{ ...claim, names: ["BUI NGUYEN DINH"] }]])
        expect(first.callsOf("orIgnore")).toHaveLength(1)
        expect(em.findOneOrFail).toHaveBeenCalledWith(PaymentClaimEntity, {
            where: { workspaceId: "ws-1", dedupeKey: "zalo:1:order-claim" },
        })
    })

    it("reads the claims that match the equalities, newest first, bounded", async () => {
        const em = mockEntityManager({ find: [PaymentClaimEntity, [entityOf()]] })
        const claims = await build(em)

        await expect(claims.query("ws-1", { leadId: "lead-1", status: "open" }, 5000)).resolves.toHaveLength(1)

        expect(em.find).toHaveBeenCalledWith(PaymentClaimEntity, {
            where: { workspaceId: "ws-1", leadId: "lead-1", status: "open" },
            order: { claimedAt: "DESC" },
            take: 100,
        })
    })

    it("lists the open claims of a workspace, oldest first, as rows", async () => {
        const em = mockEntityManager({ find: [PaymentClaimEntity, [entityOf()]] })
        const claims = await build(em)

        await expect(claims.openOf("ws-1")).resolves.toEqual([
            {
                id: "claim-1",
                workspaceId: "ws-1",
                leadId: "lead-1",
                conversationId: "conv-1",
                amountVnd: 5000,
                names: ["BUI NGUYEN DINH"],
                body: claim.body,
                claimedAt: new Date("2026-11-04T00:54:00.000Z"),
                status: "open",
            },
        ])
        expect(em.find).toHaveBeenCalledWith(PaymentClaimEntity, {
            where: { workspaceId: "ws-1", status: "open" },
            order: { claimedAt: "ASC" },
            take: 100,
        })
    })

    it("settles the open claims named, through the caller's transaction, and none when none are named", async () => {
        const own = mockEntityManager()
        const callers = mockEntityManager({ update: [PaymentClaimEntity, { affected: 1, raw: [], generatedMaps: [] }] })
        const claims = await build(own)

        await claims.settle("ws-1", [], "tx-1", callers)
        await claims.settle("ws-1", ["claim-1"], "tx-1", callers)

        expect(callers.update).toHaveBeenCalledTimes(1)
        expect(callers.update).toHaveBeenCalledWith(
            PaymentClaimEntity,
            { workspaceId: "ws-1", id: In(["claim-1"]), status: "open" },
            { status: "settled", settledTransactionId: "tx-1" },
        )
        expect(own.update).not.toHaveBeenCalled()
    })

    it("settles through its own manager when the caller has none", async () => {
        const em = mockEntityManager({ update: [PaymentClaimEntity, { affected: 1, raw: [], generatedMaps: [] }] })
        const claims = await build(em)
        await claims.settle("ws-1", ["claim-1"], null)
        expect(em.update).toHaveBeenCalledWith(PaymentClaimEntity, expect.anything(), {
            status: "settled",
            settledTransactionId: null,
        })
    })

    it("finds the open claims of any workspace made at or before the instant", async () => {
        const em = mockEntityManager({ find: [PaymentClaimEntity, [entityOf()]] })
        const claims = await build(em)
        const before = new Date("2026-11-04T01:00:00.000Z")

        await expect(claims.overdue(before, 50)).resolves.toHaveLength(1)

        expect(em.find).toHaveBeenCalledWith(PaymentClaimEntity, {
            where: { status: "open", claimedAt: LessThanOrEqual(before) },
            order: { claimedAt: "ASC" },
            take: 50,
        })
    })

    it("takes an update that reports no count as nothing escalated", async () => {
        const em = mockEntityManager({ update: [PaymentClaimEntity, { raw: [], generatedMaps: [] }] })
        const claims = await build(em)
        await expect(claims.escalate("ws-1", "claim-1")).resolves.toBe(false)
    })

    it("escalates an open claim once", async () => {
        const em = mockEntityManager({
            update: [
                [PaymentClaimEntity, { affected: 1, raw: [], generatedMaps: [] }],
                [PaymentClaimEntity, { affected: 0, raw: [], generatedMaps: [] }],
            ],
        })
        const claims = await build(em)

        await expect(claims.escalate("ws-1", "claim-1")).resolves.toBe(true)
        await expect(claims.escalate("ws-1", "claim-1")).resolves.toBe(false)
        expect(em.update).toHaveBeenCalledWith(
            PaymentClaimEntity,
            { workspaceId: "ws-1", id: "claim-1", status: "open" },
            { status: "escalated" },
        )
    })
})
