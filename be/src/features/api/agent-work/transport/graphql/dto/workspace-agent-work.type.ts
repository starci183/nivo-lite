import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The workspace-wide work switch with the counts beside it. */
export class WorkspaceAgentWorkType {
    /** False when work is switched off for the whole workspace. */
    @Field(() => Boolean)
    workEnabled!: boolean

    /** legacy or core: the road of customer intake. */
    @Field()
    road!: string

    /** Always 0: AI work has no per-day limit (owner ruling); kept until the web stops selecting it. */
    @Field(() => Int, { deprecationReason: "No per-day limit on AI work: always 0. The plan's credit pool is the only bound." })
    backgroundDailyCap!: number

    /** Agents whose own switch is off. */
    @Field(() => Int)
    agentsOff!: number

    /** Wakes waiting to run. */
    @Field(() => Int)
    pendingWakes!: number

    /** Wakes held by a switch. */
    @Field(() => Int)
    heldWakes!: number
}
