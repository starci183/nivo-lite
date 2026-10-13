import { IsString, Matches, MaxLength } from "class-validator"

/** The bounded path parameters of reading one module: its key. */
export class GetModuleRequest {
    /** The key of the module: short lowercase ASCII. */
    @IsString()
    @MaxLength(24)
    @Matches(/^[a-z][a-z0-9_]{1,23}$/u)
    key!: string
}
