import { Field, Int, ObjectType } from "@nestjs/graphql"
import { AgentGoalType } from "./agent-goal.type"
import { AgentTaskType } from "./agent-task.type"
import { AgentTriggerType } from "./agent-trigger.type"
import { AgentTurnType } from "./agent-turn.type"
import { AgentWorkStateType } from "./agent-work-state.type"

@ObjectType()
/** Everything the Work tab of one agent shows. */
export class AgentWorkType {
    /** The kill switch and the breaker. */
    @Field(() => AgentWorkStateType)
    state!: AgentWorkStateType

    /** Active and paused goals. */
    @Field(() => [AgentGoalType])
    goals!: Array<AgentGoalType>

    /** Open and waiting tasks. */
    @Field(() => [AgentTaskType])
    tasks!: Array<AgentTaskType>

    /** The triggers. */
    @Field(() => [AgentTriggerType])
    triggers!: Array<AgentTriggerType>

    /** The last turns, newest first. */
    @Field(() => [AgentTurnType])
    turns!: Array<AgentTurnType>

    /** Wakes waiting to run. */
    @Field(() => Int)
    pendingWakes!: number
}
