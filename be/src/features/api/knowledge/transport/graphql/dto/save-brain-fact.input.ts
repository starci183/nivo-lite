import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The fact an owner or manager writes. */
export class SaveBrainFactInput {
    /** What it is about. */
    @Field(() => String)
    @IsIn(["business", "product", "service", "policy", "customer", "person", "supplier", "place", "other"])
    @MaxLength(40)
    subjectType!: "business" | "product" | "service" | "policy" | "customer" | "person" | "supplier" | "place" | "other"

    /** The subject. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    subjectLabel!: string

    /** The attribute. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    attributeLabel!: string

    /** The value. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    value!: string

    /** `public`, `internal` or `restricted`. */
    @Field(() => String)
    @IsIn(["public", "internal", "restricted"])
    @MaxLength(40)
    scope!: "public" | "internal" | "restricted"

    /** The modules that may read a restricted fact. */
    @Field(() => [String])
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(64, { each: true })
    modules!: Array<string>

    /** From when it holds, ISO 8601. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    validFrom?: string

    /** Until when it holds, ISO 8601. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(40)
    validTo?: string

    /** A note kept as evidence. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string

    /** The customer question this fact answers. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    gapId?: string
}
