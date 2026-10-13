import { Matches, MaxLength } from "class-validator"

/** The template a route names. */
export class TemplateKeyRequest {
    /** The template key. */
    @Matches(/^[a-z][a-z0-9_-]{2,60}$/u)
    @MaxLength(61)
    key!: string
}
