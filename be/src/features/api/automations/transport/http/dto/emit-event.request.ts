import { IsObject, IsString, Matches, MaxLength } from "class-validator"

/** A business event a member reports. */
export class EmitEventRequest {
    /** The event name, a dotted identifier. */
    @Matches(/^[a-z][a-z0-9_.-]{0,79}$/u)
    @MaxLength(80)
    event!: string

    /** Unique per occurrence. */
    @IsString()
    @MaxLength(300)
    dedupe!: string

    /** What the event carries. */
    @IsObject()
    data!: object
}
