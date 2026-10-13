import { IsUUID, MaxLength } from "class-validator"

/** The bounded path parameter that names a command card. */
export class CandidateIdRequest {
    /** The command card. */
    @IsUUID("4")
    @MaxLength(36)
    candidateId!: string
}
