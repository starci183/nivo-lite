/** The chat conversation a candidate applied through, where messages to them also go. It is also the injection token. */
export abstract class CandidateChat {
    /** Writes a message into the conversation and delivers it on its channel; answers whether it reached the candidate. It does not throw. */
    abstract deliver(workspaceId: string, conversationId: string, text: string): Promise<boolean>
}
