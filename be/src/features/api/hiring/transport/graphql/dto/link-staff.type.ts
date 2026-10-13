import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What creating a staff profile from a hired candidate answers. */
export class LinkStaffType {
    /** The staff profile. */
    @Field(() => ID)
    staffId!: string
}
