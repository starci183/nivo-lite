import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A policy value read as a parameter: the fields of its `type` are set, the others null. */
export class BrainPolicyParameterType {
    /** `money`, `percent`, `duration`, `time_range`, `boolean` or `text`: the control the row offers. */
    @Field(() => String)
    type!: string

    /** money: whole VND (30000). */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** money: the per-unit words kept with the amount (for example "one order"), or null. */
    @Field(() => String, { nullable: true })
    per!: string | null

    /** percent: 0 to 100 (10, 12.5). */
    @Field(() => Float, { nullable: true })
    percent!: number | null

    /** duration: minutes (1440 = 1 day). */
    @Field(() => Int, { nullable: true })
    minutes!: number | null

    /** time_range: start "HH:MM". */
    @Field(() => String, { nullable: true })
    from!: string | null

    /** time_range: end "HH:MM" (earlier than the start = past midnight). */
    @Field(() => String, { nullable: true })
    to!: string | null

    /** boolean: yes (true) / no (false). */
    @Field(() => Boolean, { nullable: true })
    yes!: boolean | null

    /** text: the words. */
    @Field(() => String, { nullable: true })
    text!: string | null
}

@ObjectType()
/** Where a value comes from, and when. */
export class BrainPolicySourceType {
    /** `document`, `chat`, `learning` (self-learning), `owner_edit` (the owner edited directly), `manager_edit` or `other`. */
    @Field(() => String)
    kind!: string

    /** The document title, the chat's label, the person's name, or the evidence label. */
    @Field(() => String)
    label!: string

    /** When (ISO). */
    @Field(() => String, { nullable: true })
    at!: string | null

    /** How many pieces of evidence of that kind (for example "self-learning, from 3 answers"). */
    @Field(() => Int)
    count!: number
}

@ObjectType()
/** Who reads a value. The "customer may know" switch = `scope` public (owner only). */
export class BrainPolicyAudienceType {
    /** `public`, `internal` or `restricted`. */
    @Field(() => String)
    scope!: string

    /** The modules a restricted value is kept for. */
    @Field(() => [String])
    modules!: Array<string>

    /** Whether customer-facing steps (front desk, consult) can read it. */
    @Field(() => Boolean)
    customers!: boolean

    /** The one agent instance it is kept for, or null (the whole shop). */
    @Field(() => ID, { nullable: true })
    installationId!: string | null
}

@ObjectType()
/** One value of a policy: in force, scheduled or in history. */
export class BrainPolicyValueType {
    /** The fact id. */
    @Field(() => ID)
    factId!: string

    /** The value as stored (what the agents read). */
    @Field(() => String)
    value!: string

    /** The unit written apart, or null. */
    @Field(() => String, { nullable: true })
    unit!: string | null

    /** The value as a parameter. */
    @Field(() => BrainPolicyParameterType)
    parameter!: BrainPolicyParameterType

    /** Which version of its truth (for example "version 3"); null for a value never in force. */
    @Field(() => Int, { nullable: true })
    version!: number | null

    /** `active`, `scheduled`, `proposed`, `superseded`, `expired` or `rejected`. */
    @Field(() => String)
    status!: string

    /** From when it holds (ISO). */
    @Field(() => String, { nullable: true })
    validFrom!: string | null

    /** Until when it holds (ISO). */
    @Field(() => String, { nullable: true })
    validTo!: string | null

    /** Where it comes from. */
    @Field(() => BrainPolicySourceType)
    source!: BrainPolicySourceType

    /** Who reads it. */
    @Field(() => BrainPolicyAudienceType)
    audience!: BrainPolicyAudienceType
}

@ObjectType()
/** One waiting proposal of a policy ("waiting proposal"), with what the "Use" button calls. */
export class BrainPolicyProposalType extends BrainPolicyValueType {
    /** `set` (a value) or `retire` (stop using the value in force). */
    @Field(() => String)
    kind!: string

    /** Who filed it (an agent's module, a person, NIVO for a document). */
    @Field(() => String)
    proposedBy!: string

    /** When it was filed (ISO). */
    @Field(() => String)
    proposedAt!: string

    /** What the brain flagged (`stale`, `same_meaning`). */
    @Field(() => [String])
    flags!: Array<string>

    /** The `decideBrainFact` action of "Use": `choose` (a value) or `apply` (a retire). "Drop" is always `reject`. */
    @Field(() => String)
    useAction!: string
}
