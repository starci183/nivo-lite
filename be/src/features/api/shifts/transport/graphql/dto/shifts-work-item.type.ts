import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A decision the workbench shows next to a request or a schedule. */
export class ShiftsWorkItemType {
    /** The decision id. */
    @Field(() => ID)
    id!: string

    /** Its status. */
    @Field(() => String)
    status!: string

    /** One line saying what it asks. */
    @Field(() => String)
    summary!: string

    /** What came of it, when it ran. */
    @Field(() => String, { nullable: true })
    resultSummary!: string | null

    /** How it was decided. */
    @Field(() => String, { nullable: true })
    decidedPath!: string | null
}
