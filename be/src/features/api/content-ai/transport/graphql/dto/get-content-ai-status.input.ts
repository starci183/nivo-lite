import { Field, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The generation polling id. */
export class GetContentAiStatusInput {
    /** The root generation id returned by the mutation. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    id!: string
}
