import { InputType, Field } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Identifies the selected workspace's project to script. */
export class RequestVideoScriptInput {
    /** Project UUID. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    projectId!: string
}
