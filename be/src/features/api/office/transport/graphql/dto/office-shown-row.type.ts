import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One row a command card shows to the owner. */
export class OfficeShownRowType {
    /** The payload key. */
    @Field()
    key!: string

    /** The label in the language of the reader. */
    @Field()
    label!: string

    /** The value as text. */
    @Field()
    value!: string
}
