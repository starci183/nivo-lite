import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { LoyaltyRedemptionService } from "@modules/domain/loyalty"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersErrorCode } from "./errors/work-performers.error"
import { PerformerKitService } from "./performer-kit.service"
import { RedeemRewardPerformerService } from "./redeem-reward-performer.service"
import { WorkPerformersLogEvent } from "./work-performers.log-events"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }
const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "redeem_reward",
    subject_type: "conversation",
    subject_id: "v1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Redeem a voucher", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})
const reward: LoyaltyReward = {
    id: "r1",
    key: "voucher",
    name: "Voucher",
    kind: "voucher",
    valueVnd: 50000,
    percent: null,
    pointsCost: 500,
    stock: 5,
    perCustomerLimit: null,
    minTierKey: null,
    note: "",
    active: true,
}
const member: LoyaltyMember = {
    id: "c1",
    name: "Mai",
    phone: null,
    email: null,
    birthday: null,
    tierKey: "dong",
    points: 100,
    lifetimeSpendVnd: 0,
    visits: 1,
    lastVisitAt: null,
    joinedAt: "2026-10-01T00:00:00.000Z",
    note: "",
}
const proposalOf = (fields: Proposal["fields"] = {}): Proposal => ({
    summary: "Redeem a voucher",
    fields: { customer_id: "c1", reward_id: "r1", customer: "Mai", conversation_id: "v1", ...fields },
})

describe("RedeemRewardPerformerService", () => {
    const build = async () => {
        const logger = mock<Logger>()
        const kit = mock<PerformerKitService>()
        kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
        const redemption = mock<LoyaltyRedemptionService>()
        redemption.redeem.mockResolvedValue({ code: "QT-ITEM-1", posted: true, reward })
        const ledger = mock<LoyaltyLedgerService>()
        ledger.member.mockResolvedValue(member)
        const delivery = mock<CustomerDeliveryService>()
        delivery.inConversation.mockResolvedValue(true)
        const moduleRef = await Test.createTestingModule({
            providers: [
                RedeemRewardPerformerService,
                { provide: LOGGER, useValue: logger },
                { provide: PerformerKitService, useValue: kit },
                { provide: LoyaltyRedemptionService, useValue: redemption },
                { provide: LoyaltyLedgerService, useValue: ledger },
                { provide: CustomerDeliveryService, useValue: delivery },
            ],
        }).compile()
        return { service: moduleRef.get(RedeemRewardPerformerService), logger, kit, redemption, ledger, delivery }
    }

    it("prepares the proposal supplied by the chat", async () => {
        const { service, redemption, delivery } = await build()
        const item = itemOf({ proposal: proposalOf() })

        await expect(service.prepare(ctx, item)).resolves.toEqual({ proposal: item.proposal })
        expect(redemption.redeem).not.toHaveBeenCalled()
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })

    it("redeems by the work item key and sends the catalogue cost and remaining balance to the chat", async () => {
        const { service, kit, redemption, ledger, delivery } = await build()

        await expect(
            service.perform(ctx, itemOf(), proposalOf({ cost: 1, points: 10000 }), { name: "Owner" }),
        ).resolves.toEqual({
            summary: "rewardRedeemed|Mai|Voucher|QT-ITEM-1|500",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "QT-ITEM-1",
        })
        expect(redemption.redeem).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            customerId: "c1",
            rewardId: "r1",
            ref: "redeem:item-1",
            by: "Owner",
        })
        expect(ledger.member).toHaveBeenCalledWith("ws-1", "c1")
        expect(kit.text).toHaveBeenCalledWith(ctx, "rewardCustomer", {
            name: "Mai",
            reward: "Voucher",
            code: "QT-ITEM-1",
            cost: 500,
            points: 100,
        })
        expect(delivery.inConversation).toHaveBeenCalledWith(
            "ws-1",
            "v1",
            "rewardCustomer|Mai|Voucher|QT-ITEM-1|500|100",
        )
    })

    it("answers a repeated redemption without sending a second notice", async () => {
        const { service, redemption, ledger, delivery } = await build()
        redemption.redeem.mockResolvedValue({ code: "QT-ITEM-1", posted: false, reward })

        await expect(service.perform(ctx, itemOf(), proposalOf(), { name: "Owner" })).resolves.toEqual({
            summary: "rewardRedeemedBefore|Mai|Voucher|QT-ITEM-1|500",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "QT-ITEM-1",
        })
        expect(ledger.member).not.toHaveBeenCalled()
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })

    it("records the redemption when the request names no conversation", async () => {
        const { service, ledger, delivery } = await build()

        await expect(
            service.perform(ctx, itemOf({ lead_id: null }), proposalOf({ conversation_id: null }), { name: "Owner" }),
        ).resolves.toEqual({
            summary: "rewardRedeemed|Mai|Voucher|QT-ITEM-1|500",
            evidence: "captured",
            lead_id: null,
            detail: "QT-ITEM-1",
        })
        expect(ledger.member).not.toHaveBeenCalled()
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })

    it("uses zero as the remaining balance when the member has vanished", async () => {
        const { service, ledger, delivery } = await build()
        ledger.member.mockResolvedValue(null)

        await expect(service.perform(ctx, itemOf(), proposalOf(), { name: "Owner" })).resolves.toMatchObject({
            summary: "rewardRedeemed|Mai|Voucher|QT-ITEM-1|500",
        })
        expect(delivery.inConversation).toHaveBeenCalledWith("ws-1", "v1", "rewardCustomer|Mai|Voucher|QT-ITEM-1|500|0")
    })

    it("logs a failed chat notice and preserves the successful redemption", async () => {
        const { service, logger, delivery } = await build()
        const cause = new Error("channel unavailable")
        delivery.inConversation.mockRejectedValue(cause)

        await expect(service.perform(ctx, itemOf(), proposalOf(), { name: "Owner" })).resolves.toEqual({
            summary: "rewardRedeemed|Mai|Voucher|QT-ITEM-1|500",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "QT-ITEM-1",
        })
        expect(logger.error).toHaveBeenCalledWith(WorkPerformersLogEvent.RedeemNoticeFailed, cause, {
            workspaceId: "ws-1",
            conversationId: "v1",
        })
    })

    it("refuses a proposal without a customer", async () => {
        const { service, redemption, delivery } = await build()

        await expect(
            service.perform(ctx, itemOf(), proposalOf({ customer_id: "" }), { name: "Owner" }),
        ).rejects.toMatchObject({ code: WorkPerformersErrorCode.SubjectMissing })
        expect(redemption.redeem).not.toHaveBeenCalled()
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })

    it("refuses a proposal without a reward", async () => {
        const { service, redemption, delivery } = await build()

        await expect(
            service.perform(ctx, itemOf(), proposalOf({ reward_id: null }), { name: "Owner" }),
        ).rejects.toMatchObject({ code: WorkPerformersErrorCode.SubjectMissing })
        expect(redemption.redeem).not.toHaveBeenCalled()
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })

    it("propagates a failed redemption without sending a chat notice", async () => {
        const { service, redemption, delivery } = await build()
        const cause = new Error("redemption refused")
        redemption.redeem.mockRejectedValue(cause)

        await expect(service.perform(ctx, itemOf(), proposalOf(), { name: "Owner" })).rejects.toBe(cause)
        expect(delivery.inConversation).not.toHaveBeenCalled()
    })
})
