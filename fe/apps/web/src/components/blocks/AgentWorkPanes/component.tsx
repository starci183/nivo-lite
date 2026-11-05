import { Pane, PaneGrid, PaneSection, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { COLUMNS, ROWS, areasOf } from "./layout"
import { AgentWorkAddButton } from "@/components/composites/AgentWorkAddButton"
import { AgentWorkPhoneTabs } from "@/components/composites/AgentWorkPhoneTabs"
import { AgentWorkClockForm } from "@/components/composites/AgentWorkClockForm"
import { AgentWorkGoalForm } from "@/components/composites/AgentWorkGoalForm"
import { AgentWorkGoals } from "@/components/composites/AgentWorkGoals"
import { AgentWorkSchedule } from "@/components/composites/AgentWorkSchedule"
import { AgentWorkTasks } from "@/components/composites/AgentWorkTasks"
import { AgentWorkStatus } from "@/components/composites/AgentWorkStatus"
import { AgentWorkTurns } from "@/components/composites/AgentWorkTurns"
import { SlotView } from "@nivo-lite/agent-sdk/client"
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
    readonly phoneLabel: string
    readonly phoneWork: string
    readonly phoneGoals: string
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
    /** Which of the two panes the phone shows: the work, or the goals and schedule. */
    readonly phoneView: "work" | "goals"
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
        readonly openForm: (form: "goal" | "clock" | null) => void
        readonly phoneView: (view: "work" | "goals") => void
        readonly retry: () => void
    }
}

/** The goal field under the goals, or the line saying who may add one. */
interface FooterProps {
    readonly base: AgentWorkPanesBaseProps
    readonly canEdit: boolean
    readonly isLoading: boolean
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
    if (draft.openForm !== "goal") return null
    return (
        <AgentWorkGoalForm
            label={copy.goalNewLabel}
            placeholder={copy.goalNewPlaceholder}
            addLabel={copy.goalAdd}
            cancelLabel={copy.formCancel}
            onCancel={() => props.base.on.openForm(null)}
            value={draft.goalTitle}
            canAdd={draft.canAddGoal}
            isSaving={isSaving}
            isLoading={props.isLoading}
            onChange={props.base.on.goalTitle}
            onAdd={props.base.on.addGoal}
        />
    )
}

/** The clock form under the schedule; nothing for a person who may not add one. */
const ScheduleFooter = (props: FooterProps) => {
    const { copy, draft, isSaving } = props.base.props
    if (!props.canEdit || draft.openForm !== "clock") return null
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
            onCancel={() => props.base.on.openForm(null)}
            canAdd={draft.canAddClock}
            isSaving={isSaving}
            isLoading={props.isLoading}
            onPreset={props.base.on.preset}
            onTime={props.base.on.atTime}
            onAdd={props.base.on.addClock}
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

/** The field under the goals, through the one recipe of a slot's status. */
const goalFooterOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isLoading) => <GoalFooter base={base} canEdit={view.canEdit} isLoading={isLoading} />)

/** The form under the schedule, through the one recipe of a slot's status. */
const scheduleFooterOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isLoading) => <ScheduleFooter base={base} canEdit={view.canEdit} isLoading={isLoading} />)

/** The command at the end of a list heading that opens its add form in place; nothing for a person who may not edit. */
const addActionOf = (base: AgentWorkPanesBaseProps, form: "goal" | "clock", canEdit: boolean) =>
    canEdit ? (
        <AgentWorkAddButton
            label={base.props.copy.formOpen}
            onPress={() => base.on.openForm(base.props.draft.openForm === form ? null : form)}
        />
    ) : undefined

/** The goals read, with the command that finishes one. */
const goalsOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isLoading) => (
        <AgentWorkGoals
            label={base.props.copy.goalsTitle}
            emptyMessage={base.props.copy.goalsEmpty}
            doneLabel={base.props.copy.goalDone}
            goals={view.goals}
            canEdit={view.canEdit}
            action={addActionOf(base, "goal", view.canEdit)}
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
            action={addActionOf(base, "clock", view.canEdit)}
            isSaving={base.props.isSaving}
            isLoading={isLoading}
            onSwitch={base.on.switchTrigger}
            onRemove={base.on.removeTrigger}
        />
    ))

/** The recent turns read. */
const turnsOf = (base: AgentWorkPanesBaseProps) =>
    partOf(base, (view, isLoading) => (
        <AgentWorkTurns
            label={base.props.copy.turnsTitle}
            emptyMessage={base.props.copy.turnsEmpty}
            openLabel={base.props.copy.turnOpenItem}
            turns={view.turns}
            isLoading={isLoading}
        />
    ))

/**
 * Draws the Work tab of an agent as one PaneGrid flush under the tab line: the status band, the goals with the field that adds one,
 * the schedule with the form that adds a time, the open tasks, and the recent turns. Every band is a PaneSection.
 */
export const AgentWorkPanesBase = (props: AgentWorkPanesBaseProps) => {
    const { copy } = props.props
    return (
        <PaneGrid label={copy.paneLabel} areas={areasOf(props.props.draft.phoneView)} columns={COLUMNS} rows={ROWS}>
            <Pane area="status" surface>
                <PaneSection align="center" gap="inline">
                    {partOf(props, (view, isLoading) => (
                        <AgentWorkStatus status={view.status} isLoading={isLoading} />
                    ))}
                </PaneSection>
            </Pane>
            <Pane area="phonetabs" surface>
                <PaneSection align="center">
                    <AgentWorkPhoneTabs
                        label={copy.phoneLabel}
                        workLabel={copy.phoneWork}
                        goalsLabel={copy.phoneGoals}
                        selected={props.props.draft.phoneView}
                        onSelect={props.on.phoneView}
                    />
                </PaneSection>
            </Pane>
            <Pane area="main" surface>
                <PaneSection scroll={{ label: copy.tasksTitle }} gap="section">
                    {tasksOf(props)}
                    {turnsOf(props)}
                </PaneSection>
            </Pane>
            <Pane area="aside" surface>
                <PaneSection scroll={{ label: copy.goalsTitle }} gap="section">
                    {goalsOf(props)}
                    {goalFooterOf(props)}
                    {scheduleOf(props)}
                    {scheduleFooterOf(props)}
                </PaneSection>
            </Pane>
        </PaneGrid>
    )
}
