import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the history of an installation: a revision and how it ended. */
export class SetupRevisionType {
    /** The session. */
    @Field(() => ID)
    id!: string

    /** The revision. */
    @Field(() => Int)
    revision!: number

    /** `draft`, `applied` or `discarded`. */
    @Field()
    status!: string
}
