import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Which public document. */
export class PublicDocumentIdInput {
    /** The public document. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string
}
