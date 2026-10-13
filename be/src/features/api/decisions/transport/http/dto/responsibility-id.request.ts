import { IsUUID, MaxLength } from "class-validator"

/** The bounded path parameter that names a responsibility. */
export class ResponsibilityIdRequest {
    /** The responsibility. */
    @IsUUID("4")
    @MaxLength(36)
    responsibilityId!: string
}
