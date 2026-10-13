import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A colleague the member may swap with. */
export class ShiftsColleagueType {
    /** The profile id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The positions they work. */
    @Field(() => [ID])
    positionIds!: ReadonlyArray<string>
}
