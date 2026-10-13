import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An active staff row a member can be linked to. */
export class StaffOptionType {
    /** The staff id. */
    @Field(() => ID)
    id!: string

    /** The staff name. */
    @Field()
    name!: string

    /** The staff role label. */
    @Field()
    role!: string
}
