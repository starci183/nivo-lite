import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One stock location of the workbench. */
export class InventoryLocationType {
    /** The location id. */
    @Field(() => ID)
    id!: string

    /** The location name. */
    @Field(() => String)
    name!: string
}
