import { EmptyNotice, Section } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { PublicAskView, PublicBrainCopy, PublicCardState } from "@/modules/types"

/** What the card of the questions draws and calls. */
interface PublicAsksCardProps {
    readonly asks: PublicCardState<PublicAskView>
    readonly copy: PublicBrainCopy
    /** The owner may answer or set aside; a reader sees the questions only. */
    readonly canWrite: boolean
    readonly onSkip: (id: string) => void
}

/** One question as a row: the words customers used, how often and when, the way to answer it and, in the menu, to set it aside. */
const rowOf = (ask: PublicAskView, props: PublicAsksCardProps): ListRowData => ({
    id: ask.id,
    title: ask.question,
    description: ask.line,
    ...(props.canWrite
        ? {
              action: { label: props.copy.answerLabel, href: ask.answerHref, isPending: ask.isPending },
              actionPlacement: "end" as const,
              menu: {
                  label: props.copy.moreActions,
                  entries: [{ id: "skip", label: props.copy.skipLabel, onAction: () => props.onSkip(ask.id) }],
              },
          }
        : {}),
})

/**
 * The customer questions nobody answered yet, as a card of rows above the table: the words used, how often, and "write an answer".
 * The line under the rows says what the chatbot does meanwhile. An empty card says it once: a title and what will show here.
 */
export const PublicAsksCard = (props: PublicAsksCardProps) => {
    const { asks, copy } = props
    return (
        <Section
            kind="list"
            title={copy.asideTitle}
            headingLevel={2}
            {...(asks.count === undefined ? {} : { fact: copy.asideCount(asks.count) })}
            isLoading={asks.isLoading}
            {...(asks.error === undefined ? {} : { error: asks.error })}
            items={asks.rows.map((ask) => rowOf(ask, props))}
            empty={<EmptyNotice message={asks.emptyTitle} description={copy.asideEmptyBody} />}
            caption={copy.asideHint}
        />
    )
}
