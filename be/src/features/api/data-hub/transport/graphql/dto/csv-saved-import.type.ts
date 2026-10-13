import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import type { CsvConfig } from "@modules/domain/data-hub"
import { DataJsonScalar } from "./data-json.type"

@ObjectType()
/** The saved setup of one import, to upload again into it. */
export class CsvSavedImportType {
    /** The name of the import. */
    @Field(() => String)
    name!: string

    /** The saved config {v, source, entity, idColumn, titleColumn, dateColumn, kinds, columns, sheet?, link?}. */
    @Field(() => DataJsonScalar)
    config!: CsvConfig

    /** The file label of the last import. */
    @Field(() => String)
    file!: string

    /** The summary of the last import. */
    @Field(() => String)
    summary!: string

    /** The agents that hold a grant on this import. */
    @Field(() => [ID])
    agentIds!: ReadonlyArray<string>

    /** Minutes between two re-reads of a Google Sheets link; null is manual. */
    @Field(() => Int, { nullable: true })
    scheduleMinutes!: number | null
}
