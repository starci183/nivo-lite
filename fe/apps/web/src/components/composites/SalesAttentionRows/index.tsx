import type { AttentionItemView, SalesAttentionView, SalesAttentionActions } from "@/modules/types"
import type { ListRowData } from "@starci/grammar/common"
import { Badge, Button, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import { SalesRow } from "@/components/branches/SalesRow"
/** Supplies attention rows and the actions a person can take on them. */
interface SalesAttentionRowsProps extends SalesAttentionView {
    readonly on: SalesAttentionActions
}
/** One attention row: the customer with its marks, the age, what it needs and the steps a person can take. */
const attentionItemOf = (row: AttentionItemView, view: SalesAttentionRowsProps): ListRowData => ({
    id: row.key,
    title: row.customer,
    state: "neutral",
    ...(row.leadHref === null || row.customer === "" ? {} : { href: row.leadHref }),
    detail: (
        <SalesRow
            {...{
                chips: (
                    <>
                        <Badge tone={row.kindTone} isDot>
                            {row.kindLabel}
                        </Badge>
                        {row.stage === null ? null : <Badge tone={row.stage.tone}>{row.stage.label}</Badge>}
                        <Text as="span" size="xs" tone="muted" isStrong={row.isStale}>
                            {row.age}
                        </Text>
                    </>
                ),
                actions: renderAttentionActions({ row, p: view, on: view.on }),
                body: (
                    <>
                        {row.title === null ? null : (
                            <Text size="sm" isStrong>
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
                    </>
                ),
            }}
        />
    ),
})

/** Surface 1: opportunities that need a person, most urgent first. */
export const SalesAttentionRows = (props: SalesAttentionRowsProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.label}
        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
        items={props.rows.map((row) => attentionItemOf(row, props))}
    />
)
const renderAttentionActions = ({ row, p, on }: RenderAttentionActionsInput) => (
    <>
        {row.decisionHref === null ? null : (
            <Button intent="neutral" size="sm" href={row.decisionHref}>
                {row.kind === "clarify" ? p.answerLabel : p.decideLabel}
            </Button>
        )}
        {row.kind === "failed" && row.workItemId !== null ? (
            <>
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={row.isRetryBusy}
                    isDisabled={p.isBusy}
                    onPress={() => on.retry(row.key, row.workItemId ?? "")}
                >
                    {p.retryLabel}
                </Button>
                <Button
                    intent="neutral"
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
            <Button intent="neutral" size="sm" href={row.leadHref}>
                {p.followUpLabel}
            </Button>
        ) : null}
        {row.kind === "awaiting_reply" && row.leadHref !== null ? (
            <Button intent="neutral" size="sm" href={row.leadHref}>
                {p.replyLabel}
            </Button>
        ) : null}
    </>
)
type RenderAttentionActionsInput = {
    row: AttentionItemView
    p: SalesAttentionRowsProps
    on: SalesAttentionRowsProps["on"]
}
