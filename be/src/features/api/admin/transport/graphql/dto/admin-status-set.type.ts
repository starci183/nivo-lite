import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What setting the billing status answers. */
export class AdminStatusSetType {
    /** The status. */
    @Field()
    status!: string
}
