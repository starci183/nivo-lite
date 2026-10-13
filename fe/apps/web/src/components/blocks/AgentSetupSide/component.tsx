import { Alert } from "@starci/grammar/common"
import { SetupDraftCard } from "@/components/composites/SetupDraftCard"
import { SetupGatesCard } from "@/components/composites/SetupGatesCard"
import { SetupKnowledgeCard } from "@/components/composites/SetupKnowledgeCard"
import { SetupVersionsCard } from "@/components/composites/SetupVersionsCard"
import { SlotView } from "@/components/composites/SlotView"
import type { SetupSideView } from "@/hooks/setupSide"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { SIDE } from "./classNames"

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
        {(view) => (
            <div className={SIDE}>
                {view.unmet === null ? null : (
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
                )}
                <SetupDraftCard {...view.draft} />
                <SetupGatesCard
                    {...view.gates}
                    gateFailureTitle=""
                    gateFailure=""
                    onEditText={props.on.editText}
                    onGate={props.on.gate}
                    onStartEdit={props.on.startEdit}
                    onStopEdit={props.on.stopEdit}
                    onApply={props.on.apply}
                />
                <SetupKnowledgeCard {...view.knowledge} />
                <SetupVersionsCard {...view.versions} />
            </div>
        )}
    </SlotView>
)
