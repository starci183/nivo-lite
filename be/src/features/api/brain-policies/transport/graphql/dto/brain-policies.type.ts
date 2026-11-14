import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { BrainPolicyDerivationType } from "./brain-policy-derivation.type"
import { BrainPolicyProposalType, BrainPolicyValueType } from "./brain-policy-value.type"

@ObjectType()
/** One row of the Policies tab: one truth of the shop's rules, keyed by fact id. */
export class BrainPolicyRowType {
    /** The row's id: the value in force, else the scheduled value, else the newest waiting proposal (the "not set" state). */
    @Field(() => ID)
    factId!: string

    /** The subject key. */
    @Field(() => String)
    subjectKey!: string

    /** The attribute key. */
    @Field(() => String)
    attribute!: string

    /** The subject as people write it. */
    @Field(() => String)
    subjectLabel!: string

    /** The row's name. */
    @Field(() => String)
    attributeLabel!: string

    /** The control: `money`, `percent`, `duration`, `time_range`, `boolean` or `text`. */
    @Field(() => String)
    type!: string

    /** The value in force; null = not set. */
    @Field(() => BrainPolicyValueType, { nullable: true })
    current!: BrainPolicyValueType | null

    /** The value approved for a later start (shown as "from 01/12: ..."), or null. */
    @Field(() => BrainPolicyValueType, { nullable: true })
    scheduled!: BrainPolicyValueType | null

    /** Proposals waiting for this truth (the "N proposals" chip). */
    @Field(() => Int)
    pendingCount!: number

    /** The waiting values, newest first ("" for a proposal to stop using the value). */
    @Field(() => [String])
    pendingValues!: Array<string>

    /** The derived policy of the row (PO2); null only on a row shown without a judgement. */
    @Field(() => ID, { nullable: true })
    policyId!: string | null

    /** The human title the AI derived for the rule, without its value (for example "Inner-city delivery fee"); null = use `attributeLabel`. */
    @Field(() => String, { nullable: true })
    title!: string | null

    /** The AI's one-line reason why this truth is a rule of the shop. */
    @Field(() => String, { nullable: true })
    reason!: string | null
}

@ObjectType()
/** A subject of the truth graph and its policy rows. */
export class BrainPolicyGroupType {
    /** The subject key. */
    @Field(() => String)
    subjectKey!: string

    /** The group's title (for example "Inner-city delivery"). */
    @Field(() => String)
    subjectLabel!: string

    /** Its rows. */
    @Field(() => [BrainPolicyRowType])
    rows!: Array<BrainPolicyRowType>
}

@ObjectType()
/** A customer question no truth answered (the agent is missing it). */
export class BrainPolicyMissingType {
    /** The knowledge gap id. */
    @Field(() => ID)
    gapId!: string

    /** The agent's module that could not answer. */
    @Field(() => String)
    module!: string

    /** The question as first asked. */
    @Field(() => String)
    question!: string

    /** The subject guess. */
    @Field(() => String, { nullable: true })
    topic!: string | null

    /** The attribute guess. */
    @Field(() => String, { nullable: true })
    attributeGuess!: string | null

    /** How many times it was asked. */
    @Field(() => Int)
    count!: number

    /** When it was last asked (ISO). */
    @Field(() => String)
    lastSeenAt!: string
}

@ObjectType()
/** The Policies tab of the Second Brain. */
export class BrainPoliciesType {
    /** The groups, by subject. */
    @Field(() => [BrainPolicyGroupType])
    groups!: Array<BrainPolicyGroupType>

    /** Proposals waiting across every row (the tab's "N proposals" chip). */
    @Field(() => Int)
    pendingTotal!: number

    /** True for the workspace owner (edit, decide, the "customer may know" switch); a manager sees no buttons. */
    @Field(() => Boolean)
    canEdit!: boolean

    /** Open customer questions no truth answered, most asked first. */
    @Field(() => [BrainPolicyMissingType])
    missing!: Array<BrainPolicyMissingType>

    /** Where the AI-derived layer stands (PO2): the tab shows "deriving" while it is not `ready`. */
    @Field(() => BrainPolicyDerivationType)
    derivation!: BrainPolicyDerivationType
}

@ObjectType()
/** The drawer of one row. */
export class BrainPolicyDetailType {
    /** The row. */
    @Field(() => BrainPolicyRowType)
    row!: BrainPolicyRowType

    /** "Waiting proposals", newest first. */
    @Field(() => [BrainPolicyProposalType])
    proposals!: Array<BrainPolicyProposalType>

    /** "History": every value that was or is in force (and a scheduled one), newest version first. */
    @Field(() => [BrainPolicyValueType])
    history!: Array<BrainPolicyValueType>

    /** True for the workspace owner. */
    @Field(() => Boolean)
    canEdit!: boolean
}

@ObjectType()
/** What `setBrainPolicy` did. */
export class SetBrainPolicyResultType {
    /** `applied`, `scheduled`, `proposed` (a manager's edit waits for the owner), `invalid` or `unchanged`. */
    @Field(() => String)
    outcome!: string

    /**
     * For `invalid`: `empty`, `too_long`, `not_money`, `not_percent`, `not_duration`, `not_time_range`, `not_boolean`, `not_found`,
     * `window`, `nothing_to_change`, `owner_only`, `not_in_force` (the audience alone with no value in force).
     */
    @Field(() => String, { nullable: true })
    problem!: string | null

    /** The fact written (or in force for `unchanged`). */
    @Field(() => ID, { nullable: true })
    factId!: string | null

    /** The value as stored. */
    @Field(() => String, { nullable: true })
    value!: string | null
}

@ObjectType()
/** What `unsetBrainPolicy` did. */
export class UnsetBrainPolicyResultType {
    /** `retired`, `proposed` (a manager's request waits for the owner) or `unchanged` (nothing in force). */
    @Field(() => String)
    outcome!: string
}
