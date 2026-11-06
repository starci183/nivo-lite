/** What a person tagging an agent hands over: who tagged, whom, where and what was written. */
export interface TeamChatTag {
    /** The account of the person who wrote the message, whose right to hand work to the agent is checked. */
    readonly userId: string
    /** The agent that is tagged. */
    readonly agentId: string
    /** The room the message was written in, which becomes the subject of the work. */
    readonly roomId: string
    /** The message that tags the agent; one message tags one agent once. */
    readonly messageId: string
    /** The text of the message, which the agent receives as its task. */
    readonly text: string
}

/** What the chat asks of the work core when a person tags an agent in a message. */
export interface TeamChatTags {
    /**
     * Hands the text of a message to the tagged agent: writes the wake of kind `tag` that starts the agent graph, with the room, the message
     * and the person who wrote it. The same message tags the same agent once. False when the person may not hand work to that agent.
     */
    handOff(workspaceId: string, tag: TeamChatTag): Promise<boolean>
}
