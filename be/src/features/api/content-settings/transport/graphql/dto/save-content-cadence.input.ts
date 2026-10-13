import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, ValidateNested } from "class-validator"
import { ContentCadenceInput } from "./content-cadence.input"

@InputType()
/** Replaces the cadence; omitted channels are removed. */
export class SaveContentCadenceInput {
    /** Up to one rhythm for each supported channel. */
    @Field(() => [ContentCadenceInput])
    @IsArray()
    @ArrayMaxSize(4)
    @ValidateNested({ each: true })
    @Type(() => ContentCadenceInput)
    rows!: Array<ContentCadenceInput>
}
