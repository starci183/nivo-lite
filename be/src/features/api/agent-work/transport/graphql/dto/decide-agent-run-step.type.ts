import { Field, ObjectType } from "@nestjs/graphql"
import { AgentRunDecisionVerdict } from "./agent-run-decision.type"

@ObjectType()
/** How answering the decision of a run ended. */
export class DecideAgentRunStepType {
    /** Whether the answer was taken and the run goes on. */
    @Field()
    ok!: boolean

    /** decision_not_found, decision_closed, not_an_approver or option_not_offered; null when taken. */
    @Field(() => String, { nullable: true })
    refusal!: string | null

    /** For option_not_offered: the verdicts the waiting decision takes; null otherwise. */
    @Field(() => [AgentRunDecisionVerdict], { nullable: true })
    accepted!: ReadonlyArray<string> | null
}
