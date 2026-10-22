import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A rule of the owner's authority that applies to an agent, read-only. */
export class AgentAppliedRuleType {
    /** The action key. */
    @Field()
    action!: string

    /** The module the action belongs to. */
    @Field()
    department!: string

    /** `auto`, `ask` or `never`. */
    @Field()
    mode!: string

    /** The action runs alone strictly below this amount, VND; null for none. */
    @Field(() => Float, { nullable: true })
    limitVnd?: number | null

    /** The note shown with the rule; may be empty. */
    @Field()
    note!: string
}
