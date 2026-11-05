import {
    Alert,
    Badge,
    Cluster,
    DescriptionList,
    DropdownMenu,
    EmptyNotice,
    IconButton,
    Section,
    Stack,
    Text,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentMark } from "@/components/leaves/AgentMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { LeadPanesOn, LeadStepPane, LeadStepSectionView, LeadStepView } from "@/modules/types"

/** What the next-step region draws and its commands. */
interface LeadStepSectionProps {
    readonly pane: LeadStepPane
    readonly on: Pick<LeadPanesOn, "stepPropose" | "stepOpen">
}

const PLACEHOLDER: LeadStepSectionView = {
    current: {
        title: "",
        statusLabel: "",
        statusTone: "neutral",
        nextAction: "",
        ownerName: "",
        ownerKindText: "",
        due: null,
        isDone: false,
        isAgent: false,
        agentGlyph: "moduleChatbot",
        agentAvatarUrl: null,
    },
}

/** What the menu of the next step needs. */
interface StepMenuProps {
    readonly labels: LeadStepPane["labels"]
    readonly current: LeadStepView
    readonly on: Pick<LeadPanesOn, "stepOpen">
}

/** What the owner row needs. */
interface StepOwnerProps {
    readonly current: LeadStepView
    readonly isLoading: boolean
}

/** What the facts of the next step need. */
interface StepPartProps extends StepOwnerProps {
    readonly labels: LeadStepPane["labels"]
}

/** The menu of the next step: change the owner or the date, add the step after a finished one, or ask the agent in the Office. */
const StepMenu = (props: StepMenuProps) => {
    const { current, on } = props
    const l = props.labels
    const entries = current.isDone
        ? [{ id: "add", label: l.addLabel, onAction: () => on.stepOpen("add") }]
        : [
              { id: "reassign", label: l.reassignLabel, onAction: () => on.stepOpen("reassign") },
              { id: "due", label: l.changeDueLabel, onAction: () => on.stepOpen("due") },
              ...(current.isAgent ? [{ id: "ask", label: l.askLabel, href: l.askHref }] : []),
          ]
    return (
        <DropdownMenu
            placement="bottom end"
            entries={entries}
            trigger={<IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={l.menuLabel} />}
        />
    )
}

/** Who is accountable for the step: the mark, the name and what kind of owner it is. */
const StepOwner = (props: StepOwnerProps) => {
    const { current, isLoading } = props
    return (
        <Cluster gap="row" wrap={false}>
            {current.isAgent ? (
                <AgentMark label={current.ownerName} seed={current.ownerName} src={current.agentAvatarUrl} size="md" />
            ) : (
                <PersonAvatar name={current.ownerName} size="md" />
            )}
            <Stack gap="identity">
                <Text isStrong isLoading={isLoading}>
                    {current.ownerName}
                </Text>
                <Text size="xs" tone="muted">
                    {current.ownerKindText}
                </Text>
            </Stack>
            {current.isDone ? <Badge tone={current.statusTone}>{current.statusLabel}</Badge> : null}
        </Cluster>
    )
}

/** The task and its due date, "overdue" marked while the step is open. */
const StepFacts = (props: StepPartProps) => {
    const { current } = props
    const l = props.labels
    const due = current.due
    return (
        <DescriptionList
            isLoading={props.isLoading}
            items={[
                { id: "work", term: l.nextStepLabel, description: current.nextAction },
                {
                    id: "due",
                    term: l.dueLabel,
                    description:
                        due === null ? (
                            l.noDueLabel
                        ) : (
                            <Cluster gap="inline">
                                <Text as="span" size="sm">
                                    {`${due.relative} · ${due.date}`}
                                </Text>
                                {due.isOverdue && !current.isDone ? (
                                    <Badge tone="danger">{l.overdueLabel}</Badge>
                                ) : null}
                            </Cluster>
                        ),
                },
            ]}
        />
    )
}

/** The aside's next step: who is accountable, the task and its due date; without a step, the notice that invites an agent to propose an owner. */
export const LeadStepSection = (props: LeadStepSectionProps) => {
    const { pane, on } = props
    const l = pane.labels
    return (
        <SlotView
            slot={pane.slot}
            placeholder={PLACEHOLDER}
            labels={l.slot}
            render={(view, isLoading) => {
                const current = view.current
                const failure =
                    pane.proposeError === null ? null : (
                        <Alert tone="negative" title={l.proposeFailTitle} description={pane.proposeError} />
                    )
                if (current === null) {
                    return (
                        <Section id="responsibility" title={l.title} headingLevel={2}>
                            <Stack gap="row">
                                <EmptyNotice
                                    message={l.noOwnerTitle}
                                    description={l.noOwnerHint}
                                    actionLabel={l.proposeLabel}
                                    isActionPending={pane.isPending}
                                    onAction={on.stepPropose}
                                />
                                {failure}
                            </Stack>
                        </Section>
                    )
                }
                const part = { labels: l, current, isLoading }
                return (
                    <Section
                        id="responsibility"
                        title={l.title}
                        headingLevel={2}
                        isLoading={isLoading}
                        action={<StepMenu labels={l} current={current} on={on} />}
                    >
                        <Stack gap="row">
                            <StepOwner current={current} isLoading={isLoading} />
                            <StepFacts {...part} />
                            {failure}
                        </Stack>
                    </Section>
                )
            }}
        />
    )
}
