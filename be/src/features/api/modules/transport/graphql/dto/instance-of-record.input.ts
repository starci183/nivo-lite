import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names the record whose owning installation is asked. */
export class InstanceOfRecordInput {
    /** A work item, conversation, booking, lead flow or lead. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    recordId!: string
}
