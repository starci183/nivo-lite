import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A list of texts in both product languages. */
export class ModuleBilingualListType {
    /** The Vietnamese items. */
    @Field(() => [String])
    vi!: ReadonlyArray<string>

    /** The English items. */
    @Field(() => [String])
    en!: ReadonlyArray<string>
}
