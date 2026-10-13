import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One short stable item the setup chat learned. */
export class SetupFactType {
    /** The key in snake case. */
    @Field()
    key!: string

    /** The text. */
    @Field()
    text!: string
}
