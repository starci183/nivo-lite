import { Pane, PaneGrid, PaneSection, SectionHeader, Text } from "@starci/grammar/common"
import type { PaneGridProps } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AgentWorkClockForm } from "@/components/composites/AgentWorkClockForm"
import { AgentWorkGoalForm } from "@/components/composites/AgentWorkGoalForm"
import { AgentWorkGoals } from "@/components/composites/AgentWorkGoals"
import { AgentWorkSchedule } from "@/components/composites/AgentWorkSchedule"
import { AgentWorkTasks } from "@/components/composites/AgentWorkTasks"
import { AgentWorkStatus } from "@/components/composites/AgentWorkStatus"
import { AgentWorkTurns } from "@/components/composites/AgentWorkTurns"
import { SlotView } from "@/components/composites/SlotView"
import type { AgentWorkGoalView, AgentWorkTriggerView, AgentWorkView, DataSlot, SlotLabels } from "@/modules/types"

/** The words of the Work tab that do not come from the data. */
export interface AgentWorkCopy {
    readonly paneLabel: string
    readonly goalsTitle: string
    readonly goalsEmpty: string
    readonly goalDone: string
    readonly goalNewLabel: string
    readonly goalNewPlaceholder: string
    readonly goalAdd: string
    readonly tasksTitle: string
    readonly tasksEmpty: string
    readonly taskClose: string
    readonly taskOpenItem: string
    readonly scheduleTitle: string
    readonly scheduleEmpty: string
    readonly scheduleSwitch: string
    readonly scheduleRemove: string
    readonly scheduleMore: string
    readonly presetLabel: string
    readonly timeLabel: string
    readonly timePlaceholder: string
    readonly timeInvalid: string
    readonly scheduleAdd: string
    readonly turnsTitle: string
    readonly turnsEmpty: string
    readonly turnOpenItem: string
    readonly readOnlyHint: string
}

/** The form fields of the goal and of the clock trigger. */
export interface AgentWorkDraft {
    readonly goalTitle: string
    readonly canAddGoal: boolean
    readonly preset: string
    readonly presetOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly needsTime: boolean
    readonly atTime: string
    readonly isTimeInvalid: boolean
    readonly canAddClock: boolean
}

/** Copy, the read, the form and the commands of the Work tab. */
export interface AgentWorkPanesBaseProps {
    readonly props: {
        readonly copy: AgentWorkCopy
        readonly slot: DataSlot<AgentWorkView>
        readonly placeholder: AgentWorkView
        readonly slotLabels: SlotLabels
        readonly draft: AgentWorkDraft
        readonly isSaving: boolean
    }
    readonly on: {
        readonly goalTitle: (value: string) => void
        readonly addGoal: () => void
        readonly closeGoal: (goal: AgentWorkGoalView) => void
        readonly preset: (value: string | null) => void
        readonly atTime: (value: string) => void
        readonly addClock: () => void
        readonly switchTrigger: (trigger: AgentWorkTriggerView, enabled: boolean) => void
        readonly removeTrigger: (id: string) => void
        readonly closeTask: (id: string) => void
        readonly retry: () => void
    }
}

/**
 * The arrangement (pane-grid.choose.frame grid): on a laptop the status band across the top, goals beside open tasks, the schedule
 * beside the recent turns; on a phone the same panes stacked in that order.
 */
const AREAS: PaneGridProps["areas"] = {
    base: ["status", "goals", "tasks", "schedule", "turns"],
    medium: ["status status", "goals tasks", "schedule turns"],
}
const COLUMNS: PaneGridProps["columns"] = { base: ["fill"], medium: ["fill", "fill"] }
const ROWS: PaneGridProps["rows"] = {
    base: ["auto", "fill", "fill", "fill", "fill-2"],
    medium: ["auto", "fill", "fill-2"],
}

/** The goal field under the goals, or the line saying who may add one. */
interface FooterProps {
    readonly base: AgentWorkPanesBaseProps
    readonly canEdit: boolean
    readonly isSkeleton: boolean
}

const GoalFooter = (props: FooterProps) => {
    const { copy, draft, isSaving } = props.base.props
    if (!props.canEdit) {
        return (
            <Text size="xs" tone="muted">
                {copy.readOnlyHint}
            </Text>
        )
    }
    return (
        <AgentWorkGoalForm
            label={copy.goalNewLabel}
            placeholder={copy.goalNewPlaceholder}
            addLabel={copy.goalAdd}
            value={draft.goalTitle}
            canAdd={draft.canAddGoal}
            isSaving={isSaving}
            isSkeleton={props.isSkeleton}
            onChange={props.base.on.goalTitle}
            onAdd={props.base.on.addGoal}
        />
    )
}

/** The clock form under the schedule; nothing for a person who may not add one. */
const ScheduleFooter = (props: FooterProps) => {
    const { copy, draft, isSaving } = props.base.props
    if (!props.canEdit) return null
    return (
        <AgentWorkClockForm
            presetLabel={copy.presetLabel}
            presetOptions={draft.presetOptions}
            preset={draft.preset}
            needsTime={draft.needsTime}
            timeLabel={copy.timeLabel}
            timePlaceholder={copy.timePlaceholder}
            timeInvalid={copy.timeInvalid}
            atTime={draft.atTime}
            isTimeInvalid={draft.isTimeInvalid}
            addLabel={copy.scheduleAdd}
            canAdd={draft.canAddClock}
            isSaving={isSaving}
            isSkeleton={props.isSkeleton}
            onPreset={props.base.on.preset}
            onTime={props.base.on.atTime}
            onAdd={props.base.on.addClock}
        />
    )
}

/** What a part of the read draws: the view and whether it is the placeholder. */
type PartRender = (view: AgentWorkView, isSkeleton: boolean) => ReactNode

/** A part of the read through the one recipe of a slot's status. */
const partOf = (base: AgentWorkPanesBaseProps, render: PartRender) => (
    <SlotView
        slot={base.props.slot}
        placeholder={base.props.placeholder}
        labels={base.props.slotLabels}
        onRetry={base.on.retry}
    >
        {render}
    </SlotView>
)

/** The title of a pane with how many rows it holds. */
const titleOf = (base: AgentWorkPanesBaseProps, title: string, count: (view: AgentWorkView) => number) =>
    partOf(base, (view, isSkeleton) => (
        <SectionHeader level={2} title={title} count={count(view)} isSkeleton={isSkeleton} />
    ))

/** The goals read, with the command that finishes one. */
const goalsOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isSkeleton) => (
        <AgentWorkGoals
            label={base.props.copy.goalsTitle}
            emptyMessage={base.props.copy.goalsEmpty}
            doneLabel={base.props.copy.goalDone}
            goals={view.goals}
            canEdit={view.canEdit}
            isSaving={base.props.isSaving}
            isSkeleton={isSkeleton}
            onDone={base.on.closeGoal}
        />
    ))

/** The open tasks read, with the menu that opens or closes one. */
const tasksOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isSkeleton) => (
        <AgentWorkTasks
            words={{
                label: base.props.copy.tasksTitle,
                emptyMessage: base.props.copy.tasksEmpty,
                moreLabel: base.props.copy.scheduleMore,
                openLabel: base.props.copy.taskOpenItem,
                closeLabel: base.props.copy.taskClose,
            }}
            tasks={view.tasks}
            canEdit={view.canEdit}
            isSkeleton={isSkeleton}
            onClose={base.on.closeTask}
        />
    ))

/** The triggers read, each a sentence with its switch. */
const scheduleOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isSkeleton) => (
        <AgentWorkSchedule
            words={{
                label: base.props.copy.scheduleTitle,
                emptyMessage: base.props.copy.scheduleEmpty,
                moreLabel: base.props.copy.scheduleMore,
                switchLabel: base.props.copy.scheduleSwitch,
                removeLabel: base.props.copy.scheduleRemove,
            }}
            triggers={view.triggers}
            canEdit={view.canEdit}
            isSaving={base.props.isSaving}
            isSkeleton={isSkeleton}
            onSwitch={base.on.switchTrigger}
            onRemove={base.on.removeTrigger}
        />
    ))

/** The recent turns read. */
const turnsOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isSkeleton) => (
        <AgentWorkTurns
            label={base.props.copy.turnsTitle}
            emptyMessage={base.props.copy.turnsEmpty}
            openLabel={base.props.copy.turnOpenItem}
            turns={view.turns}
            isSkeleton={isSkeleton}
        />
    ))

/**
 * Draws the Work tab of an agent as one PaneGrid flush under the tab line: the status band, the goals with the field that adds one,
 * the open tasks, the schedule with the form that adds a clock, and the recent turns. Every band is a PaneSection.
 */
export const AgentWorkPanesBase = (props: AgentWorkPanesBaseProps) => {
    const { copy } = props.props
    return (
        <PaneGrid label={copy.paneLabel} areas={AREAS} columns={COLUMNS} rows={ROWS}>
            <Pane area="status" surface>
                <PaneSection align="center" gap="inline">
                    {partOf(props, (view, isSkeleton) => (
                        <AgentWorkStatus status={view.status} isSkeleton={isSkeleton} />
                    ))}
                </PaneSection>
            </Pane>
            <Pane area="goals" surface>
                <PaneSection>{titleOf(props, copy.goalsTitle, (view) => view.goals.length)}</PaneSection>
                <PaneSection scroll={{ label: copy.goalsTitle }}>{goalsOf(props)}</PaneSection>
                <PaneSection>
                    {partOf(props, (view, isSkeleton) => (
                        <GoalFooter base={props} canEdit={view.canEdit} isSkeleton={isSkeleton} />
                    ))}
                </PaneSection>
            </Pane>
            <Pane area="tasks" surface>
                <PaneSection>{titleOf(props, copy.tasksTitle, (view) => view.tasks.length)}</PaneSection>
                <PaneSection scroll={{ label: copy.tasksTitle }}>{tasksOf(props)}</PaneSection>
            </Pane>
            <Pane area="schedule" surface>
                <PaneSection>{titleOf(props, copy.scheduleTitle, (view) => view.triggers.length)}</PaneSection>
                <PaneSection scroll={{ label: copy.scheduleTitle }}>{scheduleOf(props)}</PaneSection>
                <PaneSection>
                    {partOf(props, (view, isSkeleton) => (
                        <ScheduleFooter base={props} canEdit={view.canEdit} isSkeleton={isSkeleton} />
                    ))}
                </PaneSection>
            </Pane>
            <Pane area="turns">
                <PaneSection>{titleOf(props, copy.turnsTitle, (view) => view.turns.rows.length)}</PaneSection>
                <PaneSection scroll={{ label: copy.turnsTitle }}>{turnsOf(props)}</PaneSection>
            </Pane>
        </PaneGrid>
    )
}
