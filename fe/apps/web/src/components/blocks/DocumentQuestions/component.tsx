import { Alert, Stack, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { CritiquePointDetail } from "@/components/composites/CritiquePointDetail"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { CritiqueChoiceView, CritiqueGroupView, CritiquePointView, DocumentQuestionsView } from "@/modules/types"

/** The anchor "see the points" of the release card scrolls to. */
export const QUESTIONS_ANCHOR = "document-questions"

/** Props for {@link DocumentQuestionsBase}. */
export interface DocumentQuestionsBaseProps {
    readonly props: DocumentQuestionsView
    readonly on: {
        readonly press: (pointId: string, choice: CritiqueChoiceView) => void
        readonly change: (value: string) => void
        readonly send: () => void
        readonly cancel: () => void
        readonly skip: (pointId: string) => void
        readonly retry: () => void
        readonly reload: () => void
    }
}

/** What one group draws. */
interface GroupProps extends DocumentQuestionsBaseProps {
    readonly group: CritiqueGroupView
    readonly isLoading: boolean
}

/** One point as a row: its title with the kind badge (no dot), and under it the quotes, the question and the buttons. */
const rowOf = (point: CritiquePointView, props: GroupProps): ListRowData => {
    const { editor, pendingId, copy } = props.props
    return {
        id: point.id,
        title: point.title,
        ...(point.badge === null ? {} : { badges: [{ label: point.badge, tone: "neutral" as const }] as const }),
        detail: (
            <CritiquePointDetail
                props={{
                    point,
                    copy,
                    editor: editor?.pointId === point.id ? editor : null,
                    isPending: pendingId === point.id,
                    isLoading: props.isLoading,
                }}
                on={{
                    press: (choice) => props.on.press(point.id, choice),
                    change: props.on.change,
                    send: props.on.send,
                    cancel: props.on.cancel,
                    skip: () => props.on.skip(point.id),
                }}
            />
        ),
    }
}

/** One card per kind of doubt: the group's name above it with its count, the points as rows divided by a seam. */
const Group = (props: GroupProps) => (
    <SurfaceCard
        kind="list"
        label={props.group.label}
        count={props.group.points.length}
        isAttention
        isLoading={props.isLoading}
        items={props.group.points.map((point) => rowOf(point, props))}
        empty={null}
    />
)

/** The notice above the points: the critic still reads (a pending Alert, no skeleton) or it did not finish (neutral, with its retry). */
const Notice = (props: DocumentQuestionsBaseProps) => {
    const { notice } = props.props
    if (notice === null) return null
    if (notice.kind === "reading") return <Alert tone="pending" title={notice.title} description={notice.body} />
    return (
        <Alert
            tone="neutral"
            title={notice.title}
            description={notice.body}
            {...(notice.retry === null ? {} : { action: { label: notice.retry.label, onAction: props.on.retry } })}
        />
    )
}

/**
 * The points the critic raised about one document: a head line on the page ground ("document · N points"), the critic's notice while it
 * reads or when it did not finish, then one card per kind of doubt through the one status recipe (a skeleton of the same cards, its own
 * failure with a retry, "no more questions" as the empty notice).
 */
export const DocumentQuestionsBase = (props: DocumentQuestionsBaseProps) => {
    const { slot, placeholder, slotLabels, copy, headLine, notice } = props.props
    return (
        <div id={QUESTIONS_ANCHOR}>
            <Stack gap="section">
                {headLine === null ? null : (
                    <Text size="xs" tone="muted">
                        {headLine}
                    </Text>
                )}
                <Notice {...props} />
                <SlotView
                    slot={slot}
                    placeholder={placeholder}
                    labels={slotLabels}
                    errorDescription={copy.errorBody}
                    emptyDescription={copy.emptyBody}
                    emptyIconSource={nivoIconSource("brain", "leading")}
                    empty={notice?.kind === "reading" ? "collapse" : "notice"}
                    frame={(inner) => <SurfaceCard ariaLabel={copy.listLabel}>{inner}</SurfaceCard>}
                    onRetry={props.on.reload}
                    render={(groups, isLoading) => (
                        <Stack gap="section">
                            {groups.map((group) => (
                                <Group key={group.id} {...props} group={group} isLoading={isLoading} />
                            ))}
                        </Stack>
                    )}
                />
            </Stack>
        </div>
    )
}
