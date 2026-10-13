import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What replacing the weekly free times of a member answers. */
export class SaveAvailabilityType {
    /** Windows saved. */
    @Field(() => Int)
    saved!: number
}
