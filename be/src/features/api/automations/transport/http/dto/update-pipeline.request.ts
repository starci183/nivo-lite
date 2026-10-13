import { IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
/** What an owner changes on one pipeline; every field is optional. */
export class UpdatePipelineRequest {
    /** Switch on or off. */
    @IsOptional()
    @IsBoolean()
    enabled?: boolean

    /** Hide or restore. */
    @IsOptional()
    @IsBoolean()
    dismissed?: boolean

    /** New setting values. */
    @IsOptional()
    @IsObject()
    values?: object

    /** The approved wording. */
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    body?: string

    /** The answer to "send by itself". */
    @IsOptional()
    @IsBoolean()
    autoSend?: boolean

    /** The Google account the spreadsheet is written with. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    googleConnectionId?: string
}
