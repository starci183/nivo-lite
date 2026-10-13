import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

/** The bounded HTTP request that writes a lesson by hand. */
export class SaveLessonRequest {
    /** The agent it is for; omitted = every agent. */
    @IsOptional()
    @IsString()
    @MaxLength(60)
    module?: string

    /** The title. */
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    title!: string

    /** What to do. */
    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    body!: string

    /** When it applies. */
    @IsOptional()
    @IsString()
    @MaxLength(300)
    appliesWhen?: string
}
