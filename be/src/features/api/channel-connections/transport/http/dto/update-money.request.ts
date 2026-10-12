import { IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the UpdateMoney operation. */
export class UpdateMoneyBody {
    /** The environment sent by the caller. */
    @IsString()
    @MaxLength(10)
    environment!: string

    /** The name sent by the caller. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The bankCode sent by the caller. */
    @IsString()
    @MaxLength(40)
    bankCode!: string

    /** The accountNumber sent by the caller. */
    @IsString()
    @MaxLength(60)
    accountNumber!: string

    /** The holder sent by the caller. */
    @IsString()
    @MaxLength(160)
    holder!: string

    /** The apiKey sent by the caller. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    apiKey?: string
}
