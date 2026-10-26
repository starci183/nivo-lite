import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A successful receipt or preference write. */
export class ChatMarkerAckType {
    /** Always true; rejected targets or receipts return an error. */
    @Field(() => Boolean)
    ok!: boolean
}
