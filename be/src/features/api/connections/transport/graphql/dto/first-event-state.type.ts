import { Field, ObjectType } from "@nestjs/graphql"
import { FirstEventType } from "./first-event.type"

@ObjectType()
/** What the wizard polls for: has the first event arrived. */
export class FirstEventStateType {
    /** The connection status. */
    @Field(() => String)
    status!: string

    /** The first event, once there is one. */
    @Field(() => FirstEventType, { nullable: true })
    firstEvent!: FirstEventType | null
}
