import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What one tried GET of an API answered. */
export class OpenApiTestType {
    /** The HTTP status. */
    @Field(() => Int)
    status!: number

    /** How many items the answer holds. */
    @Field(() => Int)
    itemCount!: number

    /** The dotted path of the items array found; empty when the answer is the list itself. */
    @Field(() => String)
    itemsPath!: string

    /** The suggested id field of an item. */
    @Field(() => String)
    idField!: string

    /** The suggested title field of an item. */
    @Field(() => String)
    titleField!: string

    /** The first field names of the first item. */
    @Field(() => [String])
    sampleKeys!: Array<string>

    /** The reason in plain Vietnamese when the call gave no usable data; null when it worked. */
    @Field(() => String, { nullable: true })
    error!: string | null
}
