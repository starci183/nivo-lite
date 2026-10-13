import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded archiveVideoProject arguments. */
export class ArchiveVideoProjectInput {
    /** projectId input. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    projectId!: string

    /** archived input. */
    @Field(() => Boolean)
    @IsBoolean()
    archived!: boolean
}
