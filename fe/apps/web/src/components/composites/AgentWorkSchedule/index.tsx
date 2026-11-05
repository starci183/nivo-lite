import type { ReactNode } from "react"
import { Switch, Cluster } from "@starci/grammar/common"
import { AgentWorkRowActions } from "@/components/branches/AgentWorkRowActions"
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
    /** The command at the end of the heading. */
    readonly action?: ReactNode
    readonly onSwitch: (trigger: AgentWorkTriggerView, enabled: boolean) => void
    readonly onRemove: (id: string) => void
}

/** The schedule of the agent: a sentence per trigger, its next run, its switch, and a menu to remove the ones a person added. */
export const AgentWorkSchedule = (props: AgentWorkScheduleProps) => (
    <AgentWorkRows
        words={props.words}
        {...(props.action === undefined ? {} : { action: props.action })}
        isLoading={props.isLoading === true}
        rows={props.triggers.map((trigger) => ({
            id: trigger.id,
            title: trigger.sentence,
            facts: [trigger.nextRunLabel],
            actions: (
                <Cluster gap="inline">
                    <Switch
                        name={`trigger-${trigger.id}`}
                        label={props.words.switchLabel}
                        isLabelHidden
                        isSelected={trigger.isEnabled}
                        isDisabled={!props.canEdit || props.isSaving}
                        onSelectedChange={(enabled) => props.onSwitch(trigger, enabled)}
                    />
                    <AgentWorkRowActions
                        menuLabel={props.words.removeLabel}
                        isDisabled={props.isSaving}
                        link={null}
                        command={
                            props.canEdit && trigger.isRemovable
                                ? { label: props.words.removeLabel, onPress: () => props.onRemove(trigger.id) }
                                : null
                        }
                    />
                </Cluster>
            ),
        }))}
    />
)
