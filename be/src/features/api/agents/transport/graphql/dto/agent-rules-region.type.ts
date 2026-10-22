import { Field, ObjectType } from "@nestjs/graphql"
import { AgentAppliedRuleType } from "./agent-applied-rule.type"

@ObjectType()
/** The rules region of the agent page: its lines, or the fact that they could not be read. */
export class AgentRulesRegionType {
    /** True when the region was read. */
    @Field()
    ok!: boolean

    /** The rules; absent when they could not be read. */
    @Field(() => [AgentAppliedRuleType], { nullable: true })
    data?: ReadonlyArray<AgentAppliedRuleType> | null
}
