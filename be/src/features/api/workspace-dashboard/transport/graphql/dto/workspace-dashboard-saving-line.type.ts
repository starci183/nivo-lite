import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One finished action with its minutes: a line of the hours-saved definition. */
export class WorkspaceDashboardSavingLineType {
    /** The action key, worded by the reader. */
    @Field()
    action!: string

    /** How many were finished in the period. */
    @Field(() => Int)
    count!: number

    /** Minutes one is worth. */
    @Field(() => Int)
    minutesEach!: number
}
