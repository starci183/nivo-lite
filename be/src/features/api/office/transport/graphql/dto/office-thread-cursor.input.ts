import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The position before which a page of the thread starts. */
export class OfficeThreadCursorInput {
    /** The `created_at` of the oldest message of the previous page. */
    @Field()
    @IsString()
    @MaxLength(40)
    createdAt!: string

    /** The id of the oldest message of the previous page. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
