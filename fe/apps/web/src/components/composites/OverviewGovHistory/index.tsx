import { Badge, List, ListItem, SectionHeader, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovHistoryRow } from "@/hooks/overviewGov"
import { STACK_CLASS_NAME, HISTORY_LIST_CLASS_NAME, HISTORY_ROW_CLASS_NAME, CHIP_ROW_CLASS_NAME } from "./classNames"

/** The figures of the history block. */
export interface OverviewGovHistoryProps {
    readonly figures: {
        readonly title: string
        readonly allLabel: string
        readonly allHref: string
        readonly empty: string
        readonly rows: ReadonlyArray<GovHistoryRow>
        readonly source: string
    }
}

/** The latest decisions of the log. */
export const OverviewGovHistory = (props: OverviewGovHistoryProps) => (
    <AccountingBlock label={props.figures.title}>
        <SectionHeader
            level={2}
            title={props.figures.title}
            action={
                <TextAction href={props.figures.allHref} appearance="section">
                    {props.figures.allLabel}
                </TextAction>
            }
        />
        <SurfaceCard ariaLabel={props.figures.title}>
            <div className={STACK_CLASS_NAME}>
                {props.figures.rows.length === 0 ? (
                    <Text tone="muted">{props.figures.empty}</Text>
                ) : (
                    <List label={props.figures.title} className={HISTORY_LIST_CLASS_NAME}>
                        {props.figures.rows.map((row) => (
                            <ListItem key={row.id} className={HISTORY_ROW_CLASS_NAME}>
                                <div className={CHIP_ROW_CLASS_NAME}>
                                    <Text size="sm" weight="semibold">
                                        {row.action}
                                    </Text>
                                    <Badge tone={row.outcomeTone}>{row.outcome}</Badge>
                                    <Text size="xs" tone="muted">
                                        {row.when}
                                    </Text>
                                </div>
                                <Text size="sm" tone="muted">
                                    {row.detail}
                                </Text>
                            </ListItem>
                        ))}
                    </List>
                )}
                <Text size="xs" tone="muted">
                    {props.figures.source}
                </Text>
            </div>
        </SurfaceCard>
    </AccountingBlock>
)
