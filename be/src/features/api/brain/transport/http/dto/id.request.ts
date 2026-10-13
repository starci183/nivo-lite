import { IsUUID, MaxLength } from "class-validator"

/** The path parameter that names one fact, lesson or gap. */
export class IdRequest {
    /** The fact, lesson or gap. */
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
