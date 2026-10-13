import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What checking in answers. */
export class CheckInType {
    /** When the check-in was recorded. */
    @Field(() => String)
    at!: string
}
