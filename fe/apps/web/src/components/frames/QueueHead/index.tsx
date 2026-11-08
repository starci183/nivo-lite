import { Badge, DropdownMenu, IconButton, IconTile, PaneSection, type DropdownMenuEntry } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import type { QueueEntryView, QueueGlyph, QueueView } from "@/modules/types"

/** The glyph of a row: what kind of work it is. */
export const QUEUE_GLYPH: Readonly<Record<QueueGlyph, IconName>> = {
    contradiction: "warning",
    fact: "review",
    missing: "moduleContent",
    expired: "messageSending",
    ask: "chat",
    proposal: "revealPassword",
    other: "info",
}

/** One resting row: the skeleton keeps the geometry of the ready list and detail. */
export const QUEUE_PLACEHOLDER: ReadonlyArray<QueueEntryView> = ["a", "b", "c", "d", "e", "f"].map((id) => ({
    id,
    source: "finding",
    rawId: id,
    filter: "all",
    glyph: "other",
    title: "",
    line: "",
    badge: { label: "", tone: "neutral" },
    head: { title: "", description: "" },
    detail: {
        heading: null,
        body: "",
        lines: [],
        quotes: [],
        tiles: [],
        notice: null,
        actions: [],
        menu: [],
        footnote: null,
    },
    aside: null,
}))

/** The words and commands of the head band. */
interface QueueHeadParts {
    readonly title: string
    readonly back: string
    readonly moreActions: string
    readonly onBack: () => void
    readonly onAct: (entryId: string, actionId: string, partId?: string) => void
}

/** What the head band of the main pane draws. */
interface QueueHeadProps {
    /** The opened item; null while nothing is open. */
    readonly entry: QueueEntryView | null
    readonly isWaiting: boolean
    readonly parts: QueueHeadParts
}

/** The menu of the opened item: the commands that are rarely used. */
const menuOf = (entry: QueueEntryView, parts: QueueHeadParts) => {
    const entries: ReadonlyArray<DropdownMenuEntry> = entry.detail.menu.map((action) => ({
        id: action.id,
        label: action.label,
        onAction: () => parts.onAct(entry.id, action.id, action.partId),
    }))
    if (entries.length === 0) return {}
    const trigger = <IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={parts.moreActions} />
    return { actions: <DropdownMenu placement="bottom end" entries={entries} trigger={trigger} /> }
}

/** The head band of the opened item: what it is, where it is filed, its kind and its menu; a phone gets the way back. */
export const QueueHead = (props: QueueHeadProps) => {
    const { entry, parts } = props
    const back = { label: parts.back, onPress: parts.onBack }
    if (entry === null) return <PaneHead title={parts.title} headingLevel={1} back={back} />
    return (
        <PaneHead
            title={entry.head.title}
            headingLevel={1}
            description={entry.head.description}
            mark={<IconTile source={nivoIconSource(QUEUE_GLYPH[entry.glyph], "leading")} tone="neutral" />}
            status={<Badge tone={entry.badge.tone}>{entry.badge.label}</Badge>}
            isLoading={props.isWaiting}
            back={back}
            {...menuOf(entry, parts)}
        />
    )
}

/** What the notice that takes the whole page draws. */
interface QueueNoticeProps {
    readonly queue: QueueView
    readonly errorBody: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly onRetry: () => void
    readonly onOpenSources: () => void
}

/** The notice that takes the whole page: nothing waits (and the way to the documents), or the page did not read (and its retry). */
export const QueueNotice = (props: QueueNoticeProps) => (
    <PaneSection align="center" grow>
        <SlotView
            slot={props.queue.slot}
            placeholder={QUEUE_PLACEHOLDER}
            labels={props.queue.slotLabels}
            errorDescription={props.errorBody}
            emptyDescription={props.emptyBody}
            emptyIconSource={nivoIconSource("brain", "leading")}
            emptyAction={{ label: props.emptyAction, onAction: props.onOpenSources }}
            onRetry={props.onRetry}
            render={() => null}
        />
    </PaneSection>
)
