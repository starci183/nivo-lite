import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What importing items from a pasted table answers. */
export class ImportPasteType {
    /** Items created. */
    @Field(() => Int)
    created!: number

    /** Items updated. */
    @Field(() => Int)
    updated!: number

    /** Items given an opening quantity. */
    @Field(() => Int)
    stocked!: number

    /** The lines that could not be read. */
    @Field(() => [String])
    skipped!: ReadonlyArray<string>
}
