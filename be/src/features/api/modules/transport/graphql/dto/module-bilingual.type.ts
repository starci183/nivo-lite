import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A text in both product languages. */
export class ModuleBilingualType {
    /** The Vietnamese text. */
    @Field()
    vi!: string

    /** The English text. */
    @Field()
    en!: string
}
