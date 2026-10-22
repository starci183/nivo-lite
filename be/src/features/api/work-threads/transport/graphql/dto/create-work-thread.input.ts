import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** The title of a new thread and what it is about. */
export class CreateWorkThreadInput {
    /** The title, 1 to 200 characters. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string

    /** The lead the thread is about; absent or null for none. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    leadId: string | null = null

    /** The order the thread is about; absent or null for none. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    orderId: string | null = null
}
