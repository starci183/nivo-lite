import { Field, ObjectType } from "@nestjs/graphql"
import { ChainStepType } from "./chain-step.type"
import { ChainSummaryType } from "./chain-summary.type"

@ObjectType()
/** The chain of a thread: its steps and its summary. */
export class WorkChainType {
    /** The steps, first to last. */
    @Field(() => [ChainStepType])
    steps!: ReadonlyArray<ChainStepType>

    /** The summary line. */
    @Field(() => ChainSummaryType)
    summary!: ChainSummaryType
}
