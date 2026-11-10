import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An invitation addressed to the signed-in person. */
export class InviteForMeType {
    /** The invitation id. */
    @Field(() => ID)
    id!: string

    /** The workspace it is for. */
    @Field(() => ID)
    workspaceId!: string

    /** The workspace name. */
    @Field()
    workspaceName!: string

    /** `manager` or `staff`. */
    @Field()
    role!: string

    /** Who invited the person, when known. */
    @Field(() => String, { nullable: true })
    invitedByName!: string | null

    /** When the invitation stops working, ISO 8601. */
    @Field()
    expiresAt!: string
}
