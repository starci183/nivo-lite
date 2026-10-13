import type { Scope, SubjectType } from "@modules/domain/brain-facts"
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that writes a fact on the Second Brain page. */
export class SaveFactRequest {
    /** What the fact is about. */
    @IsIn(["business", "product", "service", "policy", "customer", "person", "supplier", "place", "other"])
    @MaxLength(20)
    subjectType!: SubjectType

    /** The subject as people write it. */
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    subjectLabel!: string

    /** The attribute as people write it. */
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    attributeLabel!: string

    /** The value as written. */
    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    value!: string

    /** public, internal or restricted. */
    @IsIn(["public", "internal", "restricted"])
    @MaxLength(20)
    scope!: Scope

    /** The modules that may read a restricted fact. */
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @MaxLength(60, { each: true })
    modules!: Array<string>

    /** From when it holds, ISO 8601. */
    @IsOptional()
    @IsString()
    @MaxLength(40)
    validFrom?: string

    /** Until when it holds, ISO 8601. */
    @IsOptional()
    @IsString()
    @MaxLength(40)
    validTo?: string

    /** A note kept as evidence. */
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string

    /** The customer question this fact answers. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    gapId?: string
}
