import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One published version of a template. */
export class WorkflowTemplateVersionType {
    /** The version number. */
    @Field(() => Int)
    version!: number

    /** When it was published, ISO 8601. */
    @Field(() => String)
    publishedAt!: string

    /** What changed, one line each. */
    @Field(() => [String])
    changes!: ReadonlyArray<string>

    /** How many steps its graph has. */
    @Field(() => Int)
    stepCount!: number
}
