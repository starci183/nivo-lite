import { Button, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { ChatbotGapRow } from "@/modules/types"
/** The actual gap rows and resolved card words, with their current dismissal command. */
interface ChatbotGapRowsProps {
    readonly title: string
    readonly description: string
    readonly rows: ReadonlyArray<ChatbotGapRow>
    readonly emptyMessage: string
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly onDismiss: (id: string) => void
}
/** The original unanswered-question card and its Brain link/dismiss actions. */
export const ChatbotGapRows = (props: ChatbotGapRowsProps) => (
    <SurfaceCard
        kind="list"
        label={props.title}
        headingLevel={2}
        isLoading={props.isLoading}
        items={props.rows.map((row): ListRowData => {
            const badges = gapBadgesOf(row.badges)
            const dismiss = (
                <Button intent="neutral" isPending={props.isPending} onPress={() => props.onDismiss(row.id)}>
                    {row.dismissLabel}
                </Button>
            )
            return {
                id: row.id,
                title: row.title,
                description: row.line,
                ...(badges === undefined ? {} : { badges }),
                ...(row.answerHref === ""
                    ? {}
                    : { action: { label: row.answerLabel, intent: "neutral", href: row.answerHref } as const }),
                detail: dismiss,
            }
        })}
        empty={<EmptyNotice message={props.emptyMessage} />}
        footer={
            <Text size="sm" tone="muted">
                {props.description}
            </Text>
        }
    />
)
/** A row keeps the supplied operational state and at most one exception, in that order. */
const gapBadgesOf = (badges: ChatbotGapRow["badges"]): ListRowData["badges"] => {
    const [status, exception] = badges
    if (status === undefined) return undefined
    return exception === undefined ? [status] : [status, exception]
}
