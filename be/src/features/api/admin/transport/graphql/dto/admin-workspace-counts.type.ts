import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How many workspaces each filter keeps. */
export class AdminWorkspaceCountsType {
    /** The all. */
    @Field(() => Int)
    all!: number

    /** The attention. */
    @Field(() => Int)
    attention!: number

    /** The unpaid. */
    @Field(() => Int)
    unpaid!: number

    /** The idle. */
    @Field(() => Int)
    idle!: number
}
