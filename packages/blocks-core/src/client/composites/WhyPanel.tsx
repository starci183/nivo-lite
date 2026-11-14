import type { ReactNode } from "react"
import {
    Avatar,
    Cluster,
    DescriptionList,
    Heading,
    Link,
    PaneSection,
    Progress,
    Quote,
    Text,
    Timeline,
} from "@starci/grammar/common"
import type { WhyView } from "../../views/views.types"

/** The words of the why pane that are not the decision's own. */
export interface WhyWords {
    readonly pathLabel: string
    readonly factsLabel: string
    readonly sourcesLabel: string
    readonly approverLabel: string
    readonly timeLabel: string
    readonly openOnMap: string
}

/** What the why pane of one work item shows. */
interface WhyPanelProps {
    readonly view: WhyView
    readonly words: WhyWords
    readonly isLoading: boolean
}

/** What the bands that never wait for data take. */
type WhyBodyProps = Pick<WhyPanelProps, "view" | "words">

/** The part of the time the approver has used before the bar warns, then turns to danger. */
const WARN_AT_PERCENT = 50
const DANGER_AT_PERCENT = 90

/** The tone of the time bar: quiet until half the time is used, a warning past it, danger past nine tenths. */
const timeToneOf = (usedPercent: number): "accent" | "warning" | "danger" => {
    if (usedPercent > DANGER_AT_PERCENT) return "danger"
    return usedPercent > WARN_AT_PERCENT ? "warning" : "accent"
}

/** The head of the pane: the branch, the reason in one sentence and the path walked. */
const WhyHead = (props: WhyPanelProps): ReactNode => (
    <>
        <PaneSection as="header">
            <Heading level={3} isLoading={props.isLoading}>
                {props.view.heading}
            </Heading>
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.view.branch}
            </Text>
        </PaneSection>
        <PaneSection>
            <Text size="md" isLoading={props.isLoading}>
                {props.view.reason}
            </Text>
        </PaneSection>
        <PaneSection>
            <Timeline
                label={props.words.pathLabel}
                items={props.view.path.map((step) => ({
                    id: step.id,
                    title: step.title,
                    description: step.description,
                    isCurrent: step.isCurrent,
                    isAttention: step.isCurrent,
                }))}
                isLoading={props.isLoading}
            />
        </PaneSection>
    </>
)

/** The numbers read and the sources leaned on, each band drawn only when the view holds something. */
const WhyEvidence = (props: WhyBodyProps): ReactNode => (
    <>
        {props.view.facts.length === 0 ? null : (
            <PaneSection>
                <Heading level={4}>{props.words.factsLabel}</Heading>
                <DescriptionList
                    layout="columns"
                    isDivided
                    items={props.view.facts.map((fact) => ({ id: fact.id, term: fact.term, description: fact.value }))}
                />
            </PaneSection>
        )}
        {props.view.sources.length === 0 ? null : (
            <PaneSection>
                <Heading level={4}>{props.words.sourcesLabel}</Heading>
                {props.view.sources.map((source) => (
                    <Quote key={source.id} source={source.kind} byline={source.byline} text={source.text} />
                ))}
            </PaneSection>
        )}
    </>
)

/** Who approves, the limit they hold and how much of the time is used. */
const WhyApprover = (props: WhyBodyProps): ReactNode =>
    props.view.approver === null ? null : (
        <PaneSection>
            <Heading level={4}>{props.words.approverLabel}</Heading>
            <Cluster gap="identity">
                <Avatar name={props.view.approver.name} seed={props.view.approver.seed} size="sm" />
                <Text size="sm" isStrong>
                    {props.view.approver.name}
                </Text>
            </Cluster>
            <Text size="xs" tone="muted">
                {props.view.approver.limit}
            </Text>
            <Progress
                label={props.words.timeLabel}
                value={props.view.approver.usedPercent}
                valueText={props.view.approver.valueText}
                tone={timeToneOf(props.view.approver.usedPercent)}
            />
            <Text size="xs" tone="muted">
                {props.view.approver.onTimeout}
            </Text>
        </PaneSection>
    )

/**
 * Why the agent did what it did, in bands of one pane: the branch, the reason in one sentence, the path walked, the numbers read,
 * the sources leaned on, who approves and how much of the time is used. Every word is code or a record.
 */
export const WhyPanel = (props: WhyPanelProps): ReactNode => (
    <>
        <WhyHead {...props} />
        <WhyEvidence {...props} />
        <WhyApprover {...props} />
        <PaneSection as="footer">
            <Link href={props.view.mapHref} variant="plain">
                {props.words.openOnMap}
            </Link>
        </PaneSection>
    </>
)
