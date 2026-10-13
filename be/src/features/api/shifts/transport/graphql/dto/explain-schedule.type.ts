import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The explanation of a schedule. */
export class ExplainScheduleType {
    /** The text. */
    @Field(() => String)
    explanation!: string
}
