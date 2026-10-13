import { Field, ID, InputType } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

/** An empty email becomes null. */
const emptyEmail = ({ value }: TransformFnParams): unknown =>
    typeof value === "string" && value.trim() === "" ? null : value

@InputType()
/** Adds a staff row, or replaces one. */
export class SaveStaffInput {
    /** The staff id when updating; absent inserts a row. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string | null

    /** The display name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The role label. */
    @Field()
    @IsString()
    @MaxLength(80)
    role!: string

    /** The contact email; absent or blank stores none. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @Transform(emptyEmail)
    @IsEmail()
    @MaxLength(254)
    email?: string | null

    /** Whether the person is active; absent keeps the stored value on update. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean | null
}
