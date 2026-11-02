/** The actual customer-conversation interactions; read retry remains owned by each Base. */
export interface ChatbotInboxActions {
    readonly query: (query: string) => void
    readonly filter: (filter: string) => void
    readonly select: (id: string) => void
    readonly back: () => void
    readonly toggleInfo: () => void
    readonly draft: (draft: string) => void
    readonly send: () => void
    readonly toggleHandling: () => void
    readonly escalationDraft: (draft: string) => void
    readonly sendAnswer: () => void
    readonly declineAnswer: () => void
}
