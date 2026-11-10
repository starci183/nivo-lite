import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The value a truth replaced ("Truoc do 20.000 d (v2)"). */
export class BrainGraphPreviousType {
    /** The replaced fact. */
    @Field(() => ID)
    id!: string

    /** Its value. */
    @Field(() => String)
    value!: string

    /** Its version. */
    @Field(() => Int, { nullable: true })
    version!: number | null
}
