import type { ReactNode } from "react"
import {
    Avatar,
    DescriptionList,
    EmptyNotice,
    Heading,
    PaneSection,
    Progress,
    Text,
    TextAction,
    Timeline,
} from "@starci/grammar/common"
import type { WorkbenchWhyView } from "@/modules/types"
import { FOOTER_CLASS_NAME, SOURCE_CLASS_NAME, WHO_CLASS_NAME } from "./classNames"

/** The words of the why pane that are not the decision's own. */
export interface WorkbenchWhyLabels {
    readonly pathLabel: string
    readonly factsLabel: string
    readonly sourcesLabel: string
    readonly approverLabel: string
    readonly timeLabel: string
    readonly openOnMap: string
    readonly missingTitle: string
    readonly missingBody: string
}

/** What the why pane of one work item shows; a null view says the decision has no recorded path. */
export interface WorkbenchWhyProps {
    readonly view: WorkbenchWhyView | null
    readonly labels: WorkbenchWhyLabels
    /** The row's decision with `intent="commit"`; null draws no buttons (an item already closed, or no right). */
    readonly decision: ReactNode
    readonly isSkeleton: boolean
}

/**
 * Why the agent did what it did, in bands of one pane: the branch, the reason in one sentence, the path walked, the numbers read,
 * the rule it leaned on, who approves and how much of the time is used, and the decision in the footer. Every word is code or a
 * record; a model's words never appear here (workbench section 1).
 */
export const WorkbenchWhy = (props: WorkbenchWhyProps) => {
    const view = props.view
    const labels = props.labels
    if (view === null) {
        return (
            <PaneSection grow>
                <EmptyNotice message={labels.missingTitle} description={labels.missingBody} />
            </PaneSection>
        )
    }
    return (
        <>
            <PaneSection as="header">
                <Heading level={3} isSkeleton={props.isSkeleton}>
                    {view.heading}
                </Heading>
                <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                    {view.branch}
                </Text>
            </PaneSection>
            <PaneSection>
                <Text size="md" isSkeleton={props.isSkeleton}>
                    {view.reason}
                </Text>
            </PaneSection>
            <PaneSection>
                <Timeline
                    label={labels.pathLabel}
                    items={view.path.map((step) => ({
                        id: step.id,
                        title: step.title,
                        description: step.description,
                        isCurrent: step.isCurrent,
                        isAttention: step.isCurrent,
                    }))}
                    isLoading={props.isSkeleton}
                />
            </PaneSection>
            {view.facts.length === 0 ? null : (
                <PaneSection>
                    <Heading level={4}>{labels.factsLabel}</Heading>
                    <DescriptionList
                        layout="columns"
                        isDivided
                        items={view.facts.map((fact) => ({ id: fact.id, term: fact.term, description: fact.value }))}
                    />
                </PaneSection>
            )}
            {view.sources.length === 0 ? null : (
                <PaneSection>
                    <Heading level={4}>{labels.sourcesLabel}</Heading>
                    {view.sources.map((source) => (
                        <div key={source.id} className={SOURCE_CLASS_NAME}>
                            <Text size="xs" tone="muted" weight="semibold">
                                {source.kind}
                            </Text>
                            <Text size="sm">{source.text}</Text>
                            <Text size="xs" tone="muted">
                                {source.byline}
                            </Text>
                        </div>
                    ))}
                </PaneSection>
            )}
            {view.approver === null ? null : (
                <PaneSection>
                    <Heading level={4}>{labels.approverLabel}</Heading>
                    <div className={WHO_CLASS_NAME}>
                        <Avatar name={view.approver.name} seed={view.approver.seed} size="sm" />
                        <Text size="sm" weight="semibold">
                            {view.approver.name}
                        </Text>
                    </div>
                    <Text size="xs" tone="muted">
                        {view.approver.limit}
                    </Text>
                    <Progress
                        label={labels.timeLabel}
                        value={view.approver.usedPercent}
                        valueText={view.approver.valueText}
                    />
                    <Text size="xs" tone="muted">
                        {view.approver.onTimeout}
                    </Text>
                </PaneSection>
            )}
            <PaneSection as="footer">
                <div className={FOOTER_CLASS_NAME}>
                    {view.isClosed ? null : props.decision}
                    <TextAction size="sm" href={view.mapHref}>
                        {labels.openOnMap}
                    </TextAction>
                </div>
            </PaneSection>
        </>
    )
}
