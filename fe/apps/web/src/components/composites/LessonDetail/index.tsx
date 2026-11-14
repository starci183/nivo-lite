import { Button, Cluster, DescriptionList, Heading, Quote, Stack, Text, SurfaceCard } from "@starci/grammar/common"
import type { LessonActionView, LessonDetailView } from "@/modules/types"

/** What the opened lesson draws. */
interface LessonDetailProps {
    readonly detail: LessonDetailView
    /** The first read has no data yet: the words keep their boxes, the values draw as geometry. */
    readonly isLoading: boolean
    readonly onAction: (actionId: string) => void
}

/** What one command of the lesson draws. */
interface CommandProps {
    readonly action: LessonActionView
    readonly onAction: LessonDetailProps["onAction"]
}

/** One command of the lesson: the decision it asks for. */
const Command = (props: CommandProps) => (
    <Button
        intent={props.action.intent}
        isPending={props.action.isPending}
        onPress={() => props.onAction(props.action.id)}
    >
        {props.action.label}
    </Button>
)

/** What the decision on the lesson draws. */
interface DecisionProps {
    readonly actions: ReadonlyArray<LessonActionView>
    readonly onAction: LessonDetailProps["onAction"]
}

/** The decision about the lesson, end-aligned. */
const Decision = (props: DecisionProps) =>
    props.actions.length === 0 ? null : (
        <Cluster gap="inline" justify="end">
            {props.actions.map((action) => (
                <Command key={action.id} action={action} onAction={props.onAction} />
            ))}
        </Cluster>
    )

/** What the corrections behind the lesson draw. */
interface EvidenceProps {
    readonly title: string
    readonly evidence: LessonDetailView["evidence"]
    readonly isLoading: boolean
}

/** The real corrections the lesson stands on, each as words taken from the owner. */
const Evidence = (props: EvidenceProps) => (
    <Stack gap="row">
        <Heading level={3}>{props.title}</Heading>
        {props.evidence.map((one) => (
            <Quote
                key={one.id}
                {...(one.text === undefined ? {} : { text: one.text })}
                byline={one.byline}
                isLoading={props.isLoading}
            />
        ))}
    </Stack>
)

/**
 * The opened lesson under its head: what it says, the corrections it stands on, then the decision, end-aligned. While the read
 * waits the same boxes draw as geometry.
 */
export const LessonDetail = (props: LessonDetailProps) => {
    const detail = props.detail
    return (
        <Stack gap="section">
            <SurfaceCard>
                <DescriptionList
                    density="compact"
                    items={detail.terms.map((term) => ({ id: term.id, term: term.term, description: term.text }))}
                    isLoading={props.isLoading}
                />
            </SurfaceCard>
            {detail.evidence.length === 0 ? null : (
                <Evidence title={detail.evidenceTitle} evidence={detail.evidence} isLoading={props.isLoading} />
            )}
            <Decision actions={detail.actions} onAction={props.onAction} />
            {detail.footnote === null ? null : (
                <Text size="xs" tone="muted" isLoading={props.isLoading}>
                    {detail.footnote}
                </Text>
            )}
        </Stack>
    )
}
