import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Optional instance selection for the workspace's Lead Gen workbench. */
export class LeadGenWorkbenchInput {
    /** One Lead Gen agent installation; omitted selects every instance. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    installationId?: string | null
}
