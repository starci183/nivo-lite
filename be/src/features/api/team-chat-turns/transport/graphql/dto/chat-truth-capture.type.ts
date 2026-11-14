import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What "Ghi vao Second Brain" did. */
export class ChatTruthCaptureType {
    /**
     * `filed` (the card waits for the owner), `already_true`, `already_filed`, `drafting` (the agent drafts and files it), `duplicate`,
     * `not_allowed` (only the owner or a manager), `not_found`, `not_person_line`, `agent_required` (name the agent in a shared room),
     * `no_chat_turn` (that agent's module ships no chat turn).
     */
    @Field(() => String)
    outcome!: string
}
