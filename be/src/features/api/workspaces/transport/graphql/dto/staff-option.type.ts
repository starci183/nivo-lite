import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A staff row of the workspace, active or not. */
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

    /** The contact email, when there is one. */
    @Field(() => String, { nullable: true })
    email!: string | null

    /** Whether the person is active. */
    @Field(() => Boolean)
    active!: boolean
}
