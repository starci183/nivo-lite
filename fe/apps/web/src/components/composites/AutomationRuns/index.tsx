import { Badge, Disclosure, Heading, List, ListItem, Region, Text, TextAction } from "@starci/grammar/common"
import { FACTS_CLASS, PRESERVE_LINES_CLASS, ROWS_CLASS, RUN_HEAD_CLASS, RUN_ROW_CLASS, SECTION_CLASS } from "./classNames"

/** The tone of a run badge. */
type RunTone = "success" | "neutral" | "warning" | "danger"

/** One run of an automation, already in the reader language. */
type AutomationRunRow = {
    readonly id: string
    readonly statusLabel: string
    readonly tone: RunTone
    readonly whenText: string
    readonly summary: string
    readonly decisionsHref?: string
    readonly errorText?: string
    readonly message?: string
    readonly evidence?: string
}

/** What the run history shows. */
type AutomationRunsProps = {
    readonly title: string
    readonly emptyText: string
    readonly decisionsLabel: string
    readonly moreLabel: string
    readonly messageLabel: string
    readonly evidenceLabel: string
    readonly rows: ReadonlyArray<AutomationRunRow>
}

/** A labelled block of text whose line breaks stay. */
type NoteProps = { readonly label: string; readonly text: string }

const Note = (props: NoteProps) => (
    <div className={FACTS_CLASS}>
        <Text size="xs" tone="muted">
            {props.label}
        </Text>
        <div className={PRESERVE_LINES_CLASS}>
            <Text size="sm">{props.text}</Text>
        </div>
    </div>
)

/** The recent runs of one automation: when, what happened, the message, and why. */
export const AutomationRuns = (props: AutomationRunsProps) => (
    <Region className={SECTION_CLASS} label={props.title}>
        <Heading level={3}>{props.title}</Heading>
        {props.rows.length === 0 ? (
            <Text size="sm" tone="muted">
                {props.emptyText}
            </Text>
        ) : (
            <List label={props.title} className={ROWS_CLASS}>
                {props.rows.map((row) => (
                    <ListItem key={row.id} className={RUN_ROW_CLASS}>
                        <div className={RUN_HEAD_CLASS}>
                            <Badge isDot tone={row.tone}>
                                {row.statusLabel}
                            </Badge>
                            <Text size="xs" tone="muted">
                                {row.whenText}
                            </Text>
                            {row.decisionsHref === undefined ? null : (
                                <TextAction href={row.decisionsHref} size="xs" appearance="inline">
                                    {props.decisionsLabel}
                                </TextAction>
                            )}
                        </div>
                        <Text size="sm">{row.summary}</Text>
                        {row.errorText === undefined ? null : (
                            <Text size="sm" tone="muted">
                                {row.errorText}
                            </Text>
                        )}
                        {row.message === undefined && row.evidence === undefined ? null : (
                            <Disclosure title={props.moreLabel} headingLevel={4}>
                                <div className={FACTS_CLASS}>
                                    {row.message === undefined ? null : (
                                        <Note label={props.messageLabel} text={row.message} />
                                    )}
                                    {row.evidence === undefined ? null : (
                                        <Note label={props.evidenceLabel} text={row.evidence} />
                                    )}
                                </div>
                            </Disclosure>
                        )}
                    </ListItem>
                ))}
            </List>
        )}
    </Region>
)
