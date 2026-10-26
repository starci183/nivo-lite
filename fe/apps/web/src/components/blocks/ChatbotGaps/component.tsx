import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { ChatbotGapsView } from "@/hooks/chatbot"

/** Props for {@link ChatbotGapsBase}. */
export interface ChatbotGapsBaseProps {
    /** The card of a manager; null for a member who may not fill gaps (nothing is drawn). */
    readonly props: { readonly view: ChatbotGapsView | null }
    readonly on: {
        readonly reload: () => void
        readonly dismiss: (id: string) => void
    }
}

/** Draws the questions the Chatbot could not answer, each with the brain link that answers it and a dismiss. */
export const ChatbotGapsBase = (props: ChatbotGapsBaseProps) => {
    const view = props.props.view
    if (view === null) return null
    return (
        <KnowledgeRows
            section={{
                id: view.id,
                title: view.title,
                description: view.description,
                failTitle: view.failTitle,
                error: view.errorText ?? undefined,
                action: view.hasError ? { id: "reload", label: view.reloadLabel, onPress: props.on.reload } : undefined,
            }}
            label={view.title}
            isLoading={view.isLoading}
            isPending={view.isPending}
            emptyTitle={view.emptyTitle}
            rows={view.rows.map((row) => ({
                id: row.id,
                title: row.title,
                lines: [row.line],
                badges: row.badges,
                actions: [
                    { id: "answer", label: row.answerLabel, href: row.answerHref },
                    {
                        id: "dismiss",
                        label: row.dismissLabel,
                        intent: "neutral" as const,
                        onPress: () => props.on.dismiss(row.id),
                    },
                ],
            }))}
        />
    )
}
