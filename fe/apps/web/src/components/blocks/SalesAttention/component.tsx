import { Badge, Button, EmptyNotice, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SalesRow } from "@/components/branches/SalesRow"

/** One opportunity that needs a person, every word already resolved. */
export interface AttentionItemView {
    readonly key: string
    readonly kind: "decision" | "clarify" | "failed" | "overdue" | "awaiting_reply"
    readonly kindLabel: string
    readonly kindTone: BadgeTone
    readonly stage: { readonly label: string; readonly tone: BadgeTone } | null
    readonly age: string
    readonly isStale: boolean
    readonly customer: string
    readonly leadHref: string | null
    readonly title: string | null
    readonly need: string
    readonly owner: string
    /** Where the decision of this row is made: the Decisions tab opened on it. */
    readonly decisionHref: string | null
    readonly workItemId: string | null
    readonly error: string | null
    readonly isRetryBusy: boolean
    readonly isStopBusy: boolean
}

/** The words and data of the attention surface. */
export interface SalesAttentionBaseProps {
    readonly props: {
        readonly label: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly rows: ReadonlyArray<AttentionItemView>
        readonly answerLabel: string
        readonly decideLabel: string
        readonly retryLabel: string
        readonly stopLabel: string
        readonly followUpLabel: string
        readonly replyLabel: string
        /** True while a retry or a stop is in flight: every command waits. */
        readonly isBusy: boolean
    }
    readonly on: {
        readonly retry: (key: string, workItemId: string) => void
        readonly stop: (key: string, workItemId: string) => void
    }
}

/** Surface 1: opportunities that need a person, most urgent first. */
export const SalesAttentionBase = (props: SalesAttentionBaseProps) => {
    const { props: p, on } = props
    return (
        <SurfaceListCard ariaLabel={p.label} empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}>
            {p.rows.map((row) => (
                <SalesRow
                    key={row.key}
                    chips={
                        <>
                            <Badge tone={row.kindTone} isDot>
                                {row.kindLabel}
                            </Badge>
                            {row.stage === null ? null : <Badge tone={row.stage.tone}>{row.stage.label}</Badge>}
                            <Text as="span" size="xs" tone="muted" weight={row.isStale ? "semibold" : "normal"}>
                                {row.age}
                            </Text>
                        </>
                    }
                    customer={row.customer}
                    customerHref={row.leadHref}
                    actions={
                        <>
                            {row.decisionHref === null ? null : (
                                <Button variant="primary" size="sm" href={row.decisionHref}>
                                    {row.kind === "clarify" ? p.answerLabel : p.decideLabel}
                                </Button>
                            )}
                            {row.kind === "failed" && row.workItemId !== null ? (
                                <>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        isPending={row.isRetryBusy}
                                        isDisabled={p.isBusy}
                                        onPress={() => on.retry(row.key, row.workItemId ?? "")}
                                    >
                                        {p.retryLabel}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        isPending={row.isStopBusy}
                                        isDisabled={p.isBusy}
                                        onPress={() => on.stop(row.key, row.workItemId ?? "")}
                                    >
                                        {p.stopLabel}
                                    </Button>
                                </>
                            ) : null}
                            {row.kind === "overdue" && row.leadHref !== null ? (
                                <Button variant="primary" size="sm" href={row.leadHref}>
                                    {p.followUpLabel}
                                </Button>
                            ) : null}
                            {row.kind === "awaiting_reply" && row.leadHref !== null ? (
                                <Button variant="primary" size="sm" href={row.leadHref}>
                                    {p.replyLabel}
                                </Button>
                            ) : null}
                        </>
                    }
                >
                    {row.title === null ? null : (
                        <Text size="sm" weight="medium">
                            {row.title}
                        </Text>
                    )}
                    {row.need === "" ? null : (
                        <Text size="sm" tone="muted" overflow="clamp-2">
                            {row.need}
                        </Text>
                    )}
                    <Text size="xs" tone="muted">
                        {row.owner}
                    </Text>
                    {row.error === null ? null : (
                        <Text size="sm" live="assertive">
                            {row.error}
                        </Text>
                    )}
                </SalesRow>
            ))}
        </SurfaceListCard>
    )
}
