import { Fragment } from "react"
import { Divider, SectionHeader, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import type { GovStatusRow } from "@/hooks/overviewResults"
import {
    STACK_CLASS_NAME,
    GOAL_LINE_CLASS_NAME,
    STATUS_LIST_CLASS_NAME,
    STATUS_CELL_CLASS_NAME,
    STATUS_LABEL_CLASS_NAME,
    STATUS_ROW_CLASS_NAME,
} from "./classNames"

/** The figures of the results block. */
export interface OverviewGovResultsProps {
    readonly figures: {
        readonly title: string
        readonly intro: string
        readonly rows: ReadonlyArray<GovStatusRow>
        readonly service: string
        readonly goals: ReadonlyArray<{ readonly id: string; readonly text: string; readonly isSet: boolean }>
        readonly goalHref: string
        readonly goalSetLabel: string
        readonly testNote: string
    }
}

/** The status row to draw. */
interface StatusRowProps {
    readonly row: GovStatusRow
}

/** One status: what it is and what it rests on, then its figure. */
const StatusRow = (props: StatusRowProps) => (
    <div className={STATUS_ROW_CLASS_NAME}>
        <div className={STATUS_LABEL_CLASS_NAME}>
            <Text size="sm" weight="semibold">
                {props.row.label}
            </Text>
            <Text size="xs" tone="muted">
                {props.row.context}
            </Text>
        </div>
        <div className={STATUS_CELL_CLASS_NAME}>
            <Text weight="semibold">{props.row.value}</Text>
            {props.row.count === null ? null : (
                <Text size="xs" tone="muted">
                    {props.row.count}
                </Text>
            )}
        </div>
    </div>
)

/** The results by status, each figure naming what it rests on. */
export const OverviewGovResults = (props: OverviewGovResultsProps) => (
    <AccountingBlock label={props.figures.title}>
        <SectionHeader level={2} title={props.figures.title} description={props.figures.intro} />
        <SurfaceCard ariaLabel={props.figures.title}>
            <div className={STACK_CLASS_NAME}>
                <div className={STATUS_LIST_CLASS_NAME}>
                    {props.figures.rows.map((row, index) => (
                        <Fragment key={row.id}>
                            {index > 0 ? <Divider semantics="presentation" /> : null}
                            <StatusRow row={row} />
                        </Fragment>
                    ))}
                </div>
                <Text size="sm" tone="muted">
                    {props.figures.service}
                </Text>
                {props.figures.goals.map((goal) => (
                    <div key={goal.id} className={GOAL_LINE_CLASS_NAME}>
                        <Text size="sm" {...(goal.isSet ? {} : { tone: "muted" as const })}>
                            {goal.text}
                        </Text>
                        {goal.isSet ? null : (
                            <TextAction href={props.figures.goalHref}>{props.figures.goalSetLabel}</TextAction>
                        )}
                    </div>
                ))}
                <Text size="xs" tone="muted">
                    {props.figures.testNote}
                </Text>
            </div>
        </SurfaceCard>
    </AccountingBlock>
)
