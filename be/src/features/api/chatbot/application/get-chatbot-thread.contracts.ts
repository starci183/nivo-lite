/** The authorized selection of the Chatbot thread. */
export interface GetChatbotThreadRequest {
    /** The workspace selector proved by the workbench service. */
    readonly workspaceId: string
    /** The customer conversation id. */
    readonly conversationId: string
}
