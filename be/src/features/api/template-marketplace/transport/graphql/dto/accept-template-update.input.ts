import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    ValidateNested,
} from "class-validator"
import { TemplateUpdateAgreedRightInput } from "./template-update-agreed-right.input"

@InputType()
/** The branches of a newer version to take. */
export class AcceptTemplateUpdateInput {
    /** The installation. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /** The ids of the units to take. */
    @Field(() => [String])
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(200)
    @IsString({ each: true })
    @MaxLength(140, { each: true })
    unitIds!: Array<string>

    /**
     * The entries on connected accounts the owner agrees the updated flow may use, exactly as the refusal
     * AGENT_GRAPHS_RIGHTS_NEED_OWNER listed them; absent when nothing was asked of the owner.
     */
    @Field(() => [TemplateUpdateAgreedRightInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @ValidateNested({ each: true })
    @Type(() => TemplateUpdateAgreedRightInput)
    agreedRights?: Array<TemplateUpdateAgreedRightInput> | null
}
