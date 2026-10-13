import { Field, ObjectType } from "@nestjs/graphql"
import { SalesMetricsType } from "./sales-metrics.type"
import { SalesAttentionType } from "./sales-attention.type"
import { SalesDealType } from "./sales-deal.type"
import { SalesClosedHiddenType } from "./sales-closed-hidden.type"
import { SalesDecisionType } from "./sales-decision.type"
import { SalesDecidedType } from "./sales-decided.type"
import { SalesHandoffType } from "./sales-handoff.type"
import { SalesActivityType } from "./sales-activity.type"
import { SalesChoiceType } from "./sales-choice.type"
import { SalesRecurringContractType } from "./sales-recurring-contract.type"

@ObjectType()
/** Every region of the selected workspace Sales workbench. */
export class SalesWorkbenchType {
    /** The now iso. */
    @Field(() => String)
    nowIso!: string

    /** The metrics. */
    @Field(() => SalesMetricsType)
    metrics!: SalesMetricsType

    /** The attention. */
    @Field(() => [SalesAttentionType])
    attention!: ReadonlyArray<SalesAttentionType>

    /** The deals. */
    @Field(() => [SalesDealType])
    deals!: ReadonlyArray<SalesDealType>

    /** The closed hidden. */
    @Field(() => SalesClosedHiddenType)
    closedHidden!: SalesClosedHiddenType

    /** The decisions. */
    @Field(() => [SalesDecisionType])
    decisions!: ReadonlyArray<SalesDecisionType>

    /** The decided. */
    @Field(() => [SalesDecidedType])
    decided!: ReadonlyArray<SalesDecidedType>

    /** The handoffs. */
    @Field(() => [SalesHandoffType])
    handoffs!: ReadonlyArray<SalesHandoffType>

    /** The activity. */
    @Field(() => [SalesActivityType])
    activity!: ReadonlyArray<SalesActivityType>

    /** The staff. */
    @Field(() => [SalesChoiceType])
    staff!: ReadonlyArray<SalesChoiceType>

    /** The contracts. */
    @Field(() => [SalesRecurringContractType])
    contracts!: ReadonlyArray<SalesRecurringContractType>

    /** The lead options. */
    @Field(() => [SalesChoiceType])
    leadOptions!: ReadonlyArray<SalesChoiceType>
}
