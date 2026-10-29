import { builder } from "@starci/jest-preset"
import { AuthorityEntity } from "@modules/domain/authority"

/** The stored authority sheet of workspace `ws-1`, with the goals empty. */
export const entityOf = builder<AuthorityEntity>({
    workspaceId: "ws-1",
    policies: "Refunds in 7 days",
    replyStyle: "short",
    brandVoice: "warm",
    limitsNote: "ask about discounts",
    goalRevenueVnd: null,
    goalNewCustomers: null,
    goalFirstReplyMinutes: null,
    goalNote: "",
    demoSeededAt: null,
    updatedBy: "An",
    updatedAt: new Date("2026-10-12T10:00:00.000Z"),
})

/** The stored sheet with a revenue goal of five million. */
export const entityWithRevenueGoal = (): AuthorityEntity => entityOf({ goalRevenueVnd: "5000000" })
