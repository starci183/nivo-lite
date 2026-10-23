/** The bounded workspace and installation request of the Chatbot inbox. */
export interface GetChatbotOverviewRequest {
    /** The workspace selector proved by the workbench service. */
    readonly workspaceId: string
    /** Omitted or null combines the workspace's Chatbot agents. */
    readonly installationId?: string | null | undefined
}
