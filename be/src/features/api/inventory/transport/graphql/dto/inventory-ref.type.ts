import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The id of the row the write touched. */
export class InventoryRefType {
    /** The row id. */
    @Field(() => ID)
    id!: string
}
