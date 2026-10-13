import { Field, InputType, Int } from "@nestjs/graphql"
import { IsBoolean, IsIn, IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** How to reach the owner's database; the password is blank when the stored one should be kept. */
export class DatabaseTargetInput {
    /** The engine: postgres, mysql or mssql. */
    @Field(() => String)
    @IsIn(["postgres", "mysql", "mssql"])
    engine!: "postgres" | "mysql" | "mssql"

    /** The server host name or address. */
    @Field(() => String)
    @IsString()
    @MaxLength(253)
    host!: string

    /** The server port. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(65_535)
    port!: number

    /** The database name. */
    @Field(() => String)
    @IsString()
    @MaxLength(128)
    database!: string

    /** The user. */
    @Field(() => String)
    @IsString()
    @MaxLength(128)
    user!: string

    /** The password; blank keeps the stored one when the server, engine and user are unchanged. */
    @Field(() => String)
    @IsString()
    @MaxLength(512)
    password!: string

    /** True for an encrypted connection. */
    @Field(() => Boolean)
    @IsBoolean()
    ssl!: boolean
}
