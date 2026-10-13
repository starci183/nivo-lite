import { Field, Int, ObjectType } from "@nestjs/graphql"
import type { CsvMapping } from "@modules/domain/data-hub"
import { DataJsonScalar } from "./data-json.scalar"

@ObjectType()
/** What reading an import source answers before anything is saved. */
export class CsvPreviewType {
    /** The column names. */
    @Field(() => [String])
    headers!: ReadonlyArray<string>

    /** The first 10 rows. */
    @Field(() => [[String]])
    sample!: ReadonlyArray<ReadonlyArray<string>>

    /** How many data rows there are. */
    @Field(() => Int)
    total!: number

    /** The workbook tab names (empty for other sources). */
    @Field(() => [String])
    sheets!: ReadonlyArray<string>

    /** The tab that was read. */
    @Field(() => String)
    sheet!: string

    /** The detected delimiter of text sources. */
    @Field(() => String)
    delimiter!: string

    /** The suggested mapping (the saved one when uploading again): {idColumn, titleColumn, dateColumn, kinds, columns}. */
    @Field(() => DataJsonScalar)
    mapping!: CsvMapping

    /** The mapped columns of the saved setup that this data no longer has. */
    @Field(() => [String])
    missing!: ReadonlyArray<string>
}
