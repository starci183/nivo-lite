import type { WorkbenchWhyLabels, WorkbenchWhyView } from "../view/view.types"
import type { ReactNode } from "react"
import {
    Avatar,
    Cluster,
    DescriptionList,
    EmptyNotice,
    Heading,
    PaneSection,
    Progress,
    Quote,
    Text,
    Link,
    Timeline,
} from "@starci/grammar/common"
/** What the why pane of one work item shows; a null view says the decision has no recorded path. */
interface WorkbenchWhyProps {
    readonly view: WorkbenchWhyView | null
    readonly labels: WorkbenchWhyLabels
    /** The row's decision with `intent="commit"`; null draws no buttons (an item already closed, or no right). */
    readonly decision: ReactNode
    readonly isLoading: boolean
}
/** A recorded why, with the words of its bands. */
interface WhyEvidenceProps {
    readonly view: WorkbenchWhyView
    readonly labels: WorkbenchWhyLabels
}
/** The same, for the bands that draw while the facts are still being read. */
interface WhyBandsProps extends WhyEvidenceProps {
    readonly isLoading: boolean
}
/** The part of the time the approver has used before the bar warns, then turns to danger (workbench section 5). */
const WARN_AT_PERCENT = 50
const DANGER_AT_PERCENT = 90
/** The tone of the time bar: quiet until half the time is used, a warning past it, danger past nine tenths. */
const timeToneOf = (usedPercent: number): "accent" | "warning" | "danger" => {
    if (usedPercent > DANGER_AT_PERCENT) return "danger"
    return usedPercent > WARN_AT_PERCENT ? "warning" : "accent"
}
/** The head of the pane: the branch, and the reason in one sentence. */
const WhyHead = (props: WhyBandsProps) => (
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
                label={props.labels.pathLabel}
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
/** The numbers read and the rule it leaned on, each band drawn only when it holds something. */
const WhyEvidence = (props: WhyEvidenceProps) => (
    <>
        {props.view.facts.length === 0 ? null : (
            <PaneSection>
                <Heading level={4}>{props.labels.factsLabel}</Heading>
                <DescriptionList
                    layout="columns"
                    isDivided
                    items={props.view.facts.map((fact) => ({ id: fact.id, term: fact.term, description: fact.value }))}
                />
            </PaneSection>
        )}
        {props.view.sources.length === 0 ? null : (
            <PaneSection>
                <Heading level={4}>{props.labels.sourcesLabel}</Heading>
                {props.view.sources.map((source) => (
                    <Quote key={source.id} source={source.kind} byline={source.byline} text={source.text} />
                ))}
            </PaneSection>
        )}
    </>
)
/** Who approves, the limit they hold and how much of the time is used. */
const WhyApprover = (props: WhyEvidenceProps) =>
    props.view.approver === null ? null : (
        <PaneSection>
            <Heading level={4}>{props.labels.approverLabel}</Heading>
            <Cluster gap="inline">
                <Avatar name={props.view.approver.name} seed={props.view.approver.seed} size="sm" />
                <Text size="sm" isStrong>
                    {props.view.approver.name}
                </Text>
            </Cluster>
            <Text size="xs" tone="muted">
                {props.view.approver.limit}
            </Text>
            <Progress
                label={props.labels.timeLabel}
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
 * the rule it leaned on, who approves and how much of the time is used, and the decision in the footer. Every word is code or a
 * record; a model's words never appear here (workbench section 1).
 */
export const WorkbenchWhy = (props: WorkbenchWhyProps): ReactNode => {
    const view = props.view
    if (view === null) {
        return (
            <PaneSection grow>
                <EmptyNotice message={props.labels.missingTitle} description={props.labels.missingBody} />
            </PaneSection>
        )
    }
    return (
        <>
            <WhyHead view={view} labels={props.labels} isLoading={props.isLoading} />
            <WhyEvidence view={view} labels={props.labels} />
            <WhyApprover view={view} labels={props.labels} />
            <PaneSection as="footer">
                <Cluster gap="row">
                    {view.isClosed ? null : props.decision}
                    <Link href={view.mapHref}>{props.labels.openOnMap}</Link>
                </Cluster>
            </PaneSection>
        </>
    )
}
