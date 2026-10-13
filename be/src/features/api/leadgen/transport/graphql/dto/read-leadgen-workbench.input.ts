import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Optional instance scope of the Lead Gen workbench. */
export class ReadLeadGenWorkbenchInput {
    /** Omit to read every Lead Gen instance of the selected workspace. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    installationId?: string | null
}
