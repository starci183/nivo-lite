import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from "class-validator"

@InputType()
/** One field a person changes. */
export class UpdateConnectionFieldInput {
    /** The key of the field, as the form read it. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    @Matches(/^[a-zA-Z]\w{0,39}$/u)
    key!: string

    /** The new value; an empty secret keeps the sealed one. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    value!: string
}

@InputType()
/** A change of one connected account. */
export class UpdateConnectionInput {
    /** The connected account. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The new display name; absent keeps it. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    displayName?: string | null

    /** The fields that change; a field left out keeps its value. */
    @Field(() => [UpdateConnectionFieldInput])
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => UpdateConnectionFieldInput)
    fields!: Array<UpdateConnectionFieldInput>
}
