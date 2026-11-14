import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the AI-derived policy layer of the workspace stands (what the tab shows while it derives). */
export class BrainPolicyDerivationType {
    /**
     * `ready` (every truth in force is judged), `deriving` (a pass waits or runs), `failed` (the last pass was given up) or
     * `not_derived` (truths wait to be judged and no pass is queued: `deriveBrainPolicies` asks for one).
     */
    @Field(() => String)
    state!: string

    /** Truths in force or scheduled the AI has not judged yet; they join the tab when it has. */
    @Field(() => Int)
    pendingFacts!: number

    /** When a pass last left nothing to judge (ISO), or null. */
    @Field(() => String, { nullable: true })
    derivedAt!: string | null

    /** For `failed`: `model`, `credits` or `gave_up`. */
    @Field(() => String, { nullable: true })
    error!: string | null
}

@ObjectType()
/** What `deriveBrainPolicies` did. */
export class DeriveBrainPoliciesResultType {
    /** `queued` (a pass was queued) or `pending` (one already waits or runs). */
    @Field(() => String)
    outcome!: string
}
