/** What the chat asks of the work core when a person tags an agent in a message. */
export interface TeamChatTags {
    /**
     * Hands the text of a message to the tagged agent: writes the wake of kind `tag` that starts the agent graph, with the room, the message
     * and the person who wrote it. The same message tags the same agent once. False when the person may not hand work to that agent.
     */
    handOff(
        workspaceId: string,
        tag: {
            readonly userId: string
            readonly agentId: string
            readonly roomId: string
            readonly messageId: string
            readonly text: string
        },
    ): Promise<boolean>
}
