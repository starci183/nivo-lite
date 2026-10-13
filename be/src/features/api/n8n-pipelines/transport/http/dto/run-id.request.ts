import { IsUUID, MaxLength } from "class-validator"

/** The run a route names. */
export class RunIdRequest {
    /** The run id. */
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
