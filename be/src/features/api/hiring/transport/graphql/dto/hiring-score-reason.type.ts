import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the screening checklist. */
export class HiringScoreReasonType {
    /** The criterion. */
    @Field(() => String)
    criterion!: string

    /** The verdict. */
    @Field(() => String)
    status!: string

    /** The explanation. */
    @Field(() => String)
    note!: string
}
