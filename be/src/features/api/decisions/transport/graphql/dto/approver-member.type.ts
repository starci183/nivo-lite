import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One member of the workspace as an approver group can name them. */
export class ApproverMemberType {
    /** The member id (the seat, not the Auth account). */
    @Field(() => ID)
    memberId!: string

    /** The display name. */
    @Field()
    name!: string

    /** `owner`, `manager` or `staff`. */
    @Field()
    role!: string

    /** `active` or `disabled`. */
    @Field()
    status!: string

    /** The keys of the department rooms the member sits in. */
    @Field(() => [String])
    rooms!: ReadonlyArray<string>
}
