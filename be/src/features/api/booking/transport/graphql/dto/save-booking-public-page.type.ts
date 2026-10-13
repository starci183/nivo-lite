import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of save booking public page. */
export class SaveBookingPublicPageType {
    /** The workspace id. */
    @Field(() => ID)
    workspaceId!: string
}
