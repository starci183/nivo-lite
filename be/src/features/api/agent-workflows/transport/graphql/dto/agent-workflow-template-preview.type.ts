import { Field, Int, ObjectType } from "@nestjs/graphql"
import { AgentWorkflowDiffType } from "./agent-workflow-diff.type"
import { WorkflowTemplateChangeType } from "./workflow-template-change.type"

@ObjectType()
/** What accepting a newer template version would write; nothing is written. */
export class AgentWorkflowTemplatePreviewType {
    /** The template version offered. */
    @Field(() => Int)
    templateVersion!: number

    /** What each newer version changed, oldest first. */
    @Field(() => [WorkflowTemplateChangeType])
    changes!: ReadonlyArray<WorkflowTemplateChangeType>

    /** The steps both sides changed; the owner's side is kept. */
    @Field(() => [String])
    conflicts!: ReadonlyArray<string>

    /** How the new version would differ from the workflow now. */
    @Field(() => AgentWorkflowDiffType)
    diff!: AgentWorkflowDiffType
}
