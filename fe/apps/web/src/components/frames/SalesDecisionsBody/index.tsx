import type { SalesDecisionsView, DecisionRowActions } from "@/modules/types"
import type { ListRowData } from "@starci/grammar/common"
import { Badge, EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import { SalesDecisionRow } from "@/components/composites/SalesDecisionRow"
import { SalesRow } from "@/components/branches/SalesRow"
/** Supplies pending and decided sales rows with their decision actions. */
interface SalesDecisionsBodyProps extends SalesDecisionsView {
    readonly on: DecisionRowActions
}
/** Surface 3: sales decisions waiting for a person, then the ones already made. */
export const SalesDecisionsBody = (props: SalesDecisionsBodyProps) => {
    const on = props.on
    return (
        <>
            <SurfaceCard
                kind="list"
                ariaLabel={props.pendingLabel}
                empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
                items={props.pending.map((row): ListRowData => ({
                    id: row.id,
                    title: row.customer,
                    state: row.isFocused ? "informative" : "neutral",
                    ...(row.leadHref === null || row.customer === "" ? {} : { href: row.leadHref }),
                    detail: <SalesDecisionRow row={row} labels={props.rowLabels} on={on} />,
                }))}
            />
            <SurfaceCard
                kind="list"
                label={props.decidedTitle}
                headingLevel={2}
                footer={
                    <Text size="sm" tone="muted">
                        {props.decidedBody}
                    </Text>
                }
                empty={<EmptyNotice message={props.decidedEmptyTitle} description={props.decidedEmptyBody} />}
                items={props.decided.map((row): ListRowData => ({
                    id: row.id,
                    title: row.customer,
                    state: "neutral",
                    ...(row.href === null || row.customer === "" ? {} : { href: row.href }),
                    detail: (
                        <SalesRow
                            {...{
                                chips: (
                                    <>
                                        <Text as="span" isStrong>
                                            {row.action}
                                        </Text>
                                        <Badge tone={row.outcomeTone}>{row.outcomeLabel}</Badge>
                                    </>
                                ),
                                body: (
                                    <>
                                        <Text size="xs" tone="muted">
                                            {row.byline}
                                        </Text>
                                        {row.basis === null ? null : (
                                            <Text size="sm" isStrong>
                                                {row.basis}
                                            </Text>
                                        )}
                                        {row.rest === null ? null : (
                                            <Text size="sm" tone="muted" overflow="clamp-2">
                                                {row.rest}
                                            </Text>
                                        )}
                                    </>
                                ),
                            }}
                        />
                    ),
                }))}
            />
        </>
    )
}
