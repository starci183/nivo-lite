import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, MaxLength } from "class-validator"

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
}
