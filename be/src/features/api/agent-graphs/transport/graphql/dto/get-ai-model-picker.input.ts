import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, MaxLength } from "class-validator"

@InputType()
/** What aiModelPicker takes. */
export class GetAiModelPickerInput {
    /** The language the choices are written in; Vietnamese unless en is named. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["vi", "en"])
    @MaxLength(2)
    locale?: string | null
}
