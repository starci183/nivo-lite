import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of save booking policy. */
export class SaveBookingPolicyType {
    /** The workspace id. */
    @Field(() => ID)
    workspaceId!: string
}
