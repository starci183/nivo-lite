import { Pane, PaneGrid, PaneSection, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { AgentWorkClockForm } from "@/components/composites/AgentWorkClockForm"
import { AgentWorkGoalForm } from "@/components/composites/AgentWorkGoalForm"
import { AgentWorkGoals } from "@/components/composites/AgentWorkGoals"
import { AgentWorkSchedule } from "@/components/composites/AgentWorkSchedule"
import { AgentWorkTasks } from "@/components/composites/AgentWorkTasks"
import { AgentWorkStatus } from "@/components/composites/AgentWorkStatus"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type {
    AgentWorkGoalView,
    AgentWorkTriggerView,
    AgentWorkView,
    DataSlot,
    PaneGridLayout,
    SlotLabels,
} from "@/modules/types"

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
    readonly taskMenu: string
    readonly presetLabel: string
    readonly timeLabel: string
    readonly timePlaceholder: string
    readonly timeInvalid: string
    readonly scheduleAdd: string
    readonly turnsTitle: string
    readonly turnsEmpty: string
    readonly turnOpenItem: string
    readonly readOnlyHint: string
    readonly formOpen: string
    readonly formCancel: string
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
    /** The add form that is open in place under its list, if any. */
    readonly openForm: "goal" | "clock" | null
}

/** Copy, the read, the form and the commands of the Work tab. */
export interface AgentWorkPanesBaseProps {
    readonly props: {
        readonly installationId: string
        readonly view: "work" | "runs"
        readonly copy: AgentWorkCopy
        readonly slot: DataSlot<AgentWorkView>
        readonly placeholder: AgentWorkView
        readonly slotLabels: SlotLabels
        readonly draft: AgentWorkDraft
        readonly isSaving: boolean
        readonly grid: PaneGridLayout
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
        readonly openForm: (form: "goal" | "clock" | null) => void
        readonly retry: () => void
    }
}

/** What stands under the goals in their card: the add form when it is open, or the line saying who may add one. */
const goalFooterOf = (base: AgentWorkPanesBaseProps, canEdit: boolean, isLoading: boolean): ReactNode => {
    const { copy, draft, isSaving } = base.props
    if (!canEdit) {
        return (
            <Text size="xs" tone="muted">
                {copy.readOnlyHint}
            </Text>
        )
    }
    if (draft.openForm !== "goal") return undefined
    return (
        <AgentWorkGoalForm
            label={copy.goalNewLabel}
            placeholder={copy.goalNewPlaceholder}
            addLabel={copy.goalAdd}
            cancelLabel={copy.formCancel}
            onCancel={() => base.on.openForm(null)}
            value={draft.goalTitle}
            canAdd={draft.canAddGoal}
            isSaving={isSaving}
            isLoading={isLoading}
            onChange={base.on.goalTitle}
            onAdd={base.on.addGoal}
        />
    )
}

/** What stands under the schedule in its card: the clock form when it is open. */
const scheduleFooterOf = (base: AgentWorkPanesBaseProps, canEdit: boolean, isLoading: boolean): ReactNode => {
    const { copy, draft, isSaving } = base.props
    if (!canEdit || draft.openForm !== "clock") return undefined
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
            cancelLabel={copy.formCancel}
            onCancel={() => base.on.openForm(null)}
            canAdd={draft.canAddClock}
            isSaving={isSaving}
            isLoading={isLoading}
            onPreset={base.on.preset}
            onTime={base.on.atTime}
            onAdd={base.on.addClock}
        />
    )
}

/** What a part of the read draws: the view and whether it is the placeholder. */
type PartRender = (view: AgentWorkView, isLoading: boolean) => ReactNode

/** A part of the read through the one recipe of a slot's status. */
const partOf = (base: AgentWorkPanesBaseProps, render: PartRender) => (
    <SlotView
        slot={base.props.slot}
        placeholder={base.props.placeholder}
        labels={base.props.slotLabels}
        onRetry={base.on.retry}
        render={render}
    />
)

/** The command in the foot of a list card that opens its add form in place; nothing for a person who may not edit. */
const addOf = (base: AgentWorkPanesBaseProps, form: "goal" | "clock", canEdit: boolean) =>
    canEdit
        ? {
              label: base.props.copy.formOpen,
              onPress: () => base.on.openForm(base.props.draft.openForm === form ? null : form),
          }
        : undefined

/** The props of an optional add command: none when there is none. */
const spread = (add: ReturnType<typeof addOf>) => (add === undefined ? {} : { add })

/** The goals read, with the command that finishes one. */
const goalsOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isLoading) => (
        <AgentWorkGoals
            label={base.props.copy.goalsTitle}
            emptyMessage={base.props.copy.goalsEmpty}
            doneLabel={base.props.copy.goalDone}
            goals={view.goals}
            canEdit={view.canEdit}
            {...spread(addOf(base, "goal", view.canEdit))}
            footer={goalFooterOf(base, view.canEdit, isLoading)}
            isSaving={base.props.isSaving}
            isLoading={isLoading}
            onDone={base.on.closeGoal}
        />
    ))

/** The open tasks read, with the menu that opens or closes one. */
const tasksOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isLoading) => (
        <AgentWorkTasks
            words={{
                label: base.props.copy.tasksTitle,
                emptyMessage: base.props.copy.tasksEmpty,
                moreLabel: base.props.copy.taskMenu,
                openLabel: base.props.copy.taskOpenItem,
                closeLabel: base.props.copy.taskClose,
            }}
            tasks={view.tasks}
            canEdit={view.canEdit}
            isLoading={isLoading}
            onClose={base.on.closeTask}
        />
    ))

/** The triggers read, each a sentence with its switch. */
const scheduleOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isLoading) => (
        <AgentWorkSchedule
            words={{
                label: base.props.copy.scheduleTitle,
                emptyMessage: base.props.copy.scheduleEmpty,
                switchLabel: base.props.copy.scheduleSwitch,
                removeLabel: base.props.copy.scheduleRemove,
            }}
            triggers={view.triggers}
            canEdit={view.canEdit}
            {...spread(addOf(base, "clock", view.canEdit))}
            footer={scheduleFooterOf(base, view.canEdit, isLoading)}
            isSaving={base.props.isSaving}
            isLoading={isLoading}
            onSwitch={base.on.switchTrigger}
            onRemove={base.on.removeTrigger}
        />
    ))

/** The work view: the status line, then the schedule, the goals and the open tasks, one white card each, stacked on the well. */
const WorkView = (props: AgentWorkPanesBaseProps) => (
    <PaneSection gap="section">
        {partOf(props, (view, isLoading) => (
            <AgentWorkStatus status={view.status} isLoading={isLoading} />
        ))}
        {scheduleOf(props)}
        {goalsOf(props)}
        {tasksOf(props)}
    </PaneSection>
)

/**
 * Draws the work view of the Work tab of an agent as one PaneGrid flush under the page band, holding the well (the page ground) with the
 * work cards (schedule, goals, open tasks); the runs are their own page of panes.
 */
export const AgentWorkPanesBase = (props: AgentWorkPanesBaseProps) => {
    const { copy, grid } = props.props
    return (
        <PaneGrid label={copy.paneLabel} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
            <Pane area="well" scroll content="cards" label={copy.paneLabel}>
                <WorkView {...props} />
            </Pane>
        </PaneGrid>
    )
}
