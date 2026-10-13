import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of dataSyncRun. */
export class DataSyncRunInput {
    /** The run to read. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    runId!: string
}
