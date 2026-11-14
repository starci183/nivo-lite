import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_LINE } from "../../../shared/bounds"
import { SALES_LOYALTY_DECISION_ENTITY } from "../../../shared/entities/sales-entity-names"

/** What the agent proposes for a person to decide. */
export const DECISION_ACTIONS: readonly [string, ...Array<string>] = [
    "award_points",
    "redeem_reward",
    "send_promo",
    "adjust_points",
]

/** Where a decision stands. */
export const DECISION_STATUSES: readonly [string, ...Array<string>] = ["waiting", "approved", "rejected"]

type DecisionFields = {
    readonly action: FieldDef<"enum", false>
    readonly summary: FieldDef<"text", false>
    readonly draft: FieldDef<"text", false>
    readonly reason: FieldDef<"text", true>
    readonly amountVnd: FieldDef<"money_vnd", true>
    readonly customer: FieldDef<"text", false>
    readonly status: FieldDef<"enum", false>
}

const decisionFields: DecisionFields = {
    action: field.enum({ of: DECISION_ACTIONS }),
    summary: field.text({ maxLength: MAX_LINE }),
    draft: field.text({ maxLength: 20_000, default: "empty" }),
    reason: field.text({ maxLength: 2_000, nullable: true }),
    amountVnd: field.moneyVnd({ nullable: true }),
    customer: field.text({ maxLength: MAX_LINE, default: "empty" }),
    status: field.enum({ of: DECISION_STATUSES, default: { literal: "waiting" } }),
}

/** A decision about loyalty that waits for a person: award, redeem or adjust points, or send a promotion. Graph node kind `loyalty-decision`. */
export const loyaltyDecisionEntity: EntityDefinition<DecisionFields> = defineEntity({
    name: SALES_LOYALTY_DECISION_ENTITY,
    dataKind: "loyalty-decision",
    fields: decisionFields,
    indexes: [{ name: "status_created", on: ["status", "createdAt", "id"] }],
})
