import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What one template version changed. */
export class WorkflowTemplateChangeType {
    /** The template version. */
    @Field(() => Int)
    version!: number

    /** One line per change. */
    @Field(() => [String])
    lines!: ReadonlyArray<string>
}
