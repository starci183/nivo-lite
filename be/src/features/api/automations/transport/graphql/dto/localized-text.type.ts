import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A text in both languages the product speaks. */
export class LocalizedTextType {
    /** Vietnamese. */
    @Field()
    vi!: string

    /** English. */
    @Field()
    en!: string
}
