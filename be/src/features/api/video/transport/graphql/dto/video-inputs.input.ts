import { Field, ID, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsBoolean, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Project source references and instructions. */
export class VideoInputsInput {
    /** Public source identities. */
    @Field(() => [ID])
    @IsArray()
    @ArrayMaxSize(12)
    @IsUUID("4", { each: true })
    sourceIds!: Array<string>

    /** Owner instructions. */
    @Field()
    @IsString()
    @MaxLength(600)
    notes!: string

    /** Workspace media paths. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(40)
    @IsString({ each: true })
    @MaxLength(300, { each: true })
    media!: Array<string>

    /** Automation origin. */
    @Field()
    @IsBoolean()
    auto!: boolean
}
