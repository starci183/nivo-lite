import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What loading a starter set answers. */
export class ApplyStarterType {
    /** Items created. */
    @Field(() => Int)
    items!: number

    /** Suppliers created. */
    @Field(() => Int)
    suppliers!: number

    /** Recipes created. */
    @Field(() => Int)
    recipes!: number
}
