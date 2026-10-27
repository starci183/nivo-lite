import { Alert, Divider } from "@starci/grammar/common"
import { SetupDraftCard } from "@/components/composites/SetupDraftCard"
import { SetupGatesCard } from "@/components/composites/SetupGatesCard"
import { SetupKnowledgeCard } from "@/components/composites/SetupKnowledgeCard"
import { SetupVersionsCard } from "@/components/composites/SetupVersionsCard"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SetupSideView, SlotLabels } from "@/modules/types"
import { ALERT, SIDE } from "./classNames"

/** The side column as a slot, and the commands of the checklist. */
export interface AgentSetupSideBaseProps {
    readonly props: {
        readonly slot: DataSlot<SetupSideView>
        readonly placeholder: SetupSideView
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly editText: (value: string) => void
        readonly gate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
        readonly startEdit: (gateKey: string, evidence: string) => void
        readonly stopEdit: () => void
        readonly apply: () => void
        readonly open: (href: string) => void
        readonly retry: () => void
    }
}

/** Draws the side column of the Setup tab: the requirements, the draft, the checklist, the knowledge and the versions. */
export const AgentSetupSideBase = (props: AgentSetupSideBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(view, isSkeleton) => (
            <div className={SIDE}>
                {view.unmet === null ? null : (
                    <div className={ALERT}>
                        <Alert
                            title={view.unmet.title}
                            description={view.unmet.body}
                            tone="cautionary"
                            appearance="soft"
                            action={{
                                label: view.unmet.actionLabel,
                                onAction: () => props.on.open(view.unmet?.href ?? ""),
                            }}
                        />
                    </div>
                )}
                <SetupGatesCard
                    {...view.gates}
                    isSkeleton={isSkeleton}
                    gateFailureTitle=""
                    gateFailure=""
                    onEditText={props.on.editText}
                    onGate={props.on.gate}
                    onStartEdit={props.on.startEdit}
                    onStopEdit={props.on.stopEdit}
                    onApply={props.on.apply}
                />
                <Divider semantics="presentation" />
                <SetupDraftCard {...view.draft} isSkeleton={isSkeleton} />
                <Divider semantics="presentation" />
                <SetupKnowledgeCard {...view.knowledge} isSkeleton={isSkeleton} />
                <Divider semantics="presentation" />
                <SetupVersionsCard {...view.versions} isSkeleton={isSkeleton} />
            </div>
        )}
    </SlotView>
)
