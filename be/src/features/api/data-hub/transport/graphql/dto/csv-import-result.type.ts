import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What an import answers. */
export class CsvImportResultType {
    /** The connection the rows went into. */
    @Field(() => ID)
    connectionId!: string

    /** How many rows are new. */
    @Field(() => Int)
    added!: number

    /** How many existing rows were updated. */
    @Field(() => Int)
    updated!: number

    /** How many rows were skipped because their id was empty or too long. */
    @Field(() => Int)
    skipped!: number

    /** How many rows the connection holds now. */
    @Field(() => Int)
    total!: number

    /** The one-line summary saved on the connection. */
    @Field(() => String)
    summary!: string
}
