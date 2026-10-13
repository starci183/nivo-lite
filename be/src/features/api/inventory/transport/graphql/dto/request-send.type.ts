import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What asking the owner to send a purchase order answers. */
export class RequestSendType {
    /** The status of the decision. */
    @Field(() => String)
    status!: string
}
