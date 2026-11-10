import type { ReactNode } from "react"
import { Switch } from "@starci/grammar/common"
import { AgentWorkRows } from "@/components/branches/AgentWorkRows"
import type { AgentWorkTriggerView } from "@/modules/types"
/** The triggers of the agent as sentences, each with its switch. */
interface AgentWorkScheduleProps {
    readonly words: {
        readonly label: string
        readonly emptyMessage: string
        readonly switchLabel: string
        readonly removeLabel: string
    }
    readonly triggers: ReadonlyArray<AgentWorkTriggerView>
    readonly canEdit: boolean
    readonly isSaving: boolean
    readonly isLoading: boolean
    /** The command in the foot of the card. */
    readonly add?: { readonly label: string; readonly onPress: () => void }
    /** What stands under the rows in the card. */
    readonly footer?: ReactNode
    readonly onSwitch: (trigger: AgentWorkTriggerView, enabled: boolean) => void
    readonly onRemove: (id: string) => void
}

/** The schedule of the agent: a sentence per trigger, its next run, its switch, and a menu to remove the ones a person added. */
export const AgentWorkSchedule = (props: AgentWorkScheduleProps) => (
    <AgentWorkRows
        words={props.words}
        emptyIcon="calendar"
        {...(props.footer === undefined ? {} : { footer: props.footer })}
        {...(props.add === undefined ? {} : { add: props.add })}
        isLoading={props.isLoading === true}
        rows={props.triggers.map((trigger) => ({
            id: trigger.id,
            title: trigger.sentence,
            facts: [trigger.nextRunLabel],
            control: (
                <Switch
                    name={`trigger-${trigger.id}`}
                    label={props.words.switchLabel}
                    isLabelHidden
                    isSelected={trigger.isEnabled}
                    isDisabled={!props.canEdit || props.isSaving}
                    onSelectedChange={(enabled) => props.onSwitch(trigger, enabled)}
                />
            ),
            ...(props.canEdit && trigger.isRemovable
                ? {
                      menu: {
                          label: props.words.removeLabel,
                          entries: [{ id: "remove", label: props.words.removeLabel, onAction: () => props.onRemove(trigger.id) }],
                      },
                  }
                : {}),
        }))}
    />
)
