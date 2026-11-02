import { Disclosure, Divider, EmptyNotice, Stack, Text, Section } from "@starci/grammar/common"
import { PRESERVE_LINES_CLASS } from "./classNames"

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
    <Stack gap="identity">
        <Text size="xs" tone="muted">
            {props.label}
        </Text>
        <div className={PRESERVE_LINES_CLASS}>
            <Text size="sm">{props.text}</Text>
        </div>
    </Stack>
)

/** The recent runs of one automation: when, what happened, the message, and why. */
export const AutomationRuns = (props: AutomationRunsProps) => (
    <>
        <Divider semantics="presentation" />
        <Section
            kind="list"
            title={props.title}
            headingLevel={3}
            items={props.rows.map((row) => ({
                id: row.id,
                title: row.summary,
                description: row.whenText,
                badges: [{ label: row.statusLabel, tone: row.tone, isDot: true }],
                ...(row.decisionsHref === undefined
                    ? {}
                    : { action: { label: props.decisionsLabel, href: row.decisionsHref } }),
                detail:
                    row.errorText === undefined &&
                    row.message === undefined &&
                    row.evidence === undefined ? undefined : (
                        <Stack gap="row">
                            {row.errorText === undefined ? null : (
                                <Text size="sm" tone="muted">
                                    {row.errorText}
                                </Text>
                            )}
                            {row.message === undefined && row.evidence === undefined ? null : (
                                <Disclosure
                                    title={props.moreLabel}
                                    headingLevel={4}
                                    body={
                                        <Stack gap="row">
                                            {row.message === undefined ? null : (
                                                <Note label={props.messageLabel} text={row.message} />
                                            )}
                                            {row.evidence === undefined ? null : (
                                                <Note label={props.evidenceLabel} text={row.evidence} />
                                            )}
                                        </Stack>
                                    }
                                />
                            )}
                        </Stack>
                    ),
            }))}
            empty={<EmptyNotice message={props.emptyText} />}
        />
    </>
)
