import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The mailbox settings shared by testImapConnection and saveImapConnection. */
export class ImapConnectionInput {
    /** The mailbox connection being edited; absent for a new one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null

    /** The connection name, up to 80 characters. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    name!: string

    /** The mailbox address. */
    @Field(() => String)
    @IsString()
    @MaxLength(400)
    email!: string

    /** The IMAP server. */
    @Field(() => String)
    @IsString()
    @MaxLength(400)
    host!: string

    /** The IMAP port, 1 to 65535. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(65_535)
    port!: number

    /** The security: tls or starttls. */
    @Field(() => String)
    @IsIn(["tls", "starttls"])
    @MaxLength(16)
    security!: string

    /** The login name. */
    @Field(() => String)
    @IsString()
    @MaxLength(400)
    user!: string

    /** The app password; blank on an existing connection keeps the saved one. */
    @Field(() => String)
    @IsString()
    @MaxLength(1000)
    password!: string

    /** The folders to read (up to 20 are kept). */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @IsString({ each: true })
    @MaxLength(400, { each: true })
    folders?: Array<string> | null

    /** How many days back a first read goes: 7, 30 or 90. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(3650)
    sinceDays?: number | null

    /** Minutes between scheduled syncs: 15, 60 or 360; null is manual only. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10_080)
    syncEveryMinutes?: number | null
}
