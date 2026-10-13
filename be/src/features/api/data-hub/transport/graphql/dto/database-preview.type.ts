import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One preview row: its cells in the order of the columns. */
export class DatabasePreviewRowType {
    /** The cells as short text. */
    @Field(() => [String])
    cells!: Array<string>
}

@ObjectType()
/** The first rows of a mapped table. */
export class DatabasePreviewType {
    /** The column names. */
    @Field(() => [String])
    columns!: Array<string>

    /** The rows. */
    @Field(() => [DatabasePreviewRowType])
    rows!: Array<DatabasePreviewRowType>
}
