import { IsBoolean, IsOptional } from "class-validator"

/** The bounded HTTP body of the CheckMeta operation. */
export class CheckMetaBody {
    /** The repair sent by the caller. */
    @IsOptional()
    @IsBoolean()
    repair?: boolean
}
