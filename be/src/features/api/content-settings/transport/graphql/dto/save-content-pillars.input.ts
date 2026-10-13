import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, ValidateNested } from "class-validator"
import { ContentPillarInput } from "./content-pillar.input"

@InputType()
/** Replaces every theme with the bounded edited list. */
export class SaveContentPillarsInput {
    /** Omitted saved rows are removed; an empty list removes all themes. */
    @Field(() => [ContentPillarInput])
    @IsArray()
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => ContentPillarInput)
    rows!: Array<ContentPillarInput>
}
