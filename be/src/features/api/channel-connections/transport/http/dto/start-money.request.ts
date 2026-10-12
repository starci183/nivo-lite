import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the StartMoney operation. */
export class StartMoneyBody {
    /** The provider sent by the caller. */
    @IsString()
    @MaxLength(20)
    provider!: string

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
}
