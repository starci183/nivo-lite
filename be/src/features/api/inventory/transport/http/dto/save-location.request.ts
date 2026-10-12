import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of create or rename one stock location. */
export class SaveLocationRequest {
    /** The location to rename; absent creates one. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The location name. */
    @IsString()
    @MaxLength(60)
    name!: string
}
