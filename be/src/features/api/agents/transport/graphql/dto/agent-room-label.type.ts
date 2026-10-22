import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A department room as the agent page names it. */
export class AgentRoomLabelType {
    /** The room key. */
    @Field()
    key!: string

    /** The display name. */
    @Field()
    name!: string
}
