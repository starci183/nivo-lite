import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The answer of an agents mutation that returns nothing else. */
export class AgentAckType {
    /** Always true: a failure is an error answer. */
    @Field()
    ok!: boolean
}
