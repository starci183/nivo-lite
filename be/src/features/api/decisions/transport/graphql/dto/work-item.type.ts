import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { ProposalType } from "./proposal.type"
import { WorkResultType } from "./work-result.type"

@ObjectType()
/** One work item as the Decisions and Approvals pages read it. */
export class WorkItemType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspace_id!: string

    /** The module that performs it. */
    @Field()
    department!: string

    /** The action key. */
    @Field()
    action!: string

    /** The kind of record it is about. */
    @Field()
    subject_type!: string

    /** The id of that record. */
    @Field(() => ID, { nullable: true })
    subject_id?: string | null

    /** The customer it is about. */
    @Field(() => ID, { nullable: true })
    lead_id?: string | null

    /** The input that started it. */
    @Field(() => ID, { nullable: true })
    inbound_event_id?: string | null

    /** The item that asked for it. */
    @Field(() => ID, { nullable: true })
    parent_id?: string | null

    /** The root of its command chain. */
    @Field(() => ID, { nullable: true })
    chain_id?: string | null

    /** Hops from the root. */
    @Field(() => Int)
    depth!: number

    /** `queued`, `done`, `waiting_decision`, `rejected` or `failed`. */
    @Field()
    status!: string

    /** `auto` or `human`. */
    @Field(() => String, { nullable: true })
    decided_path?: string | null

    /** Why the gate asked. */
    @Field(() => String, { nullable: true })
    reason?: string | null

    /** Every reason, the first one is `reason`. */
    @Field(() => [String])
    reasons!: ReadonlyArray<string>

    /** Required fields still missing. */
    @Field(() => [String])
    missing_fields!: ReadonlyArray<string>

    /** What the agent proposes. */
    @Field(() => ProposalType)
    proposal!: ProposalType

    /** What was done. */
    @Field(() => WorkResultType, { nullable: true })
    result?: WorkResultType | null

    /** The failure, when it failed. */
    @Field(() => String, { nullable: true })
    error?: string | null

    /** How much evidence backs the result. */
    @Field()
    evidence_state!: string

    /** The staff member it is assigned to. */
    @Field(() => ID, { nullable: true })
    assigned_staff_id?: string | null

    /** The approval card behind it. */
    @Field(() => ID, { nullable: true })
    execution_id?: string | null

    /** Real or simulated. */
    @Field()
    origin!: string

    /** When it was created, ISO 8601. */
    @Field()
    created_at!: string

    /** When it last changed, ISO 8601. */
    @Field()
    updated_at!: string

    /** When it finished, ISO 8601. */
    @Field(() => String, { nullable: true })
    completed_at?: string | null

    /** The agent instance that handles it. */
    @Field(() => ID, { nullable: true })
    installation_id?: string | null
}
