import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The answer of a mutation that returns nothing else. */
export class AgentWorkAckType {
    /** Always true: a failure is an error answer. */
    @Field(() => Boolean)
    ok!: boolean
}
