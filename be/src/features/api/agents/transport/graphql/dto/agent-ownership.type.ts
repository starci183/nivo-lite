import { Field, ID, ObjectType } from "@nestjs/graphql"
import { AgentOwnerCardType } from "./agent-owner-card.type"
import { AgentOwnersType } from "./agent-owners.type"
import { AgentRoomLabelType } from "./agent-room-label.type"

@ObjectType()
/** Who answers for an agent and who may give it work. */
export class AgentOwnershipType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The stored owner, or null when that member is gone. */
    @Field(() => AgentOwnerCardType, { nullable: true })
    owner?: AgentOwnerCardType | null

    /** The stored fallback, or null when that member is gone. */
    @Field(() => AgentOwnerCardType, { nullable: true })
    fallback?: AgentOwnerCardType | null

    /** Who answers right now. */
    @Field(() => AgentOwnersType)
    responder!: AgentOwnersType

    /** The roles that may hand the agent work. */
    @Field(() => [String])
    assignableRoles!: ReadonlyArray<string>

    /** The rooms whose members may hand the agent work. */
    @Field(() => [AgentRoomLabelType])
    assignableRooms!: ReadonlyArray<AgentRoomLabelType>
}
