import { Alert, Disclosure, Stack, Text } from "@starci/grammar/common"
import { SetupMeter } from "@/components/branches/SetupMeter"
import { AgentSetupChecklist } from "@/components/composites/AgentSetupChecklist"
import { SetupDraftCard } from "@/components/composites/SetupDraftCard"
import { SetupKnowledgeCard } from "@/components/composites/SetupKnowledgeCard"
import { SetupVersionsCard } from "@/components/composites/SetupVersionsCard"
import type { AgentSetupCopy, SetupSideView } from "@/modules/types"
import { LIST_MEASURE_CLASS_NAME } from "./classNames"

/** Resolved ready checklist anatomy and the same gate commands, with no read status. */
interface AgentSetupBandProps {
    readonly view: SetupSideView
    readonly isLoading: boolean
    readonly copy: AgentSetupCopy
    readonly emptyLabel: string
    readonly onGate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
    readonly onStartEdit: (gateKey: string, evidence: string) => void
    readonly onStopEdit: () => void
    readonly onEditText: (value: string) => void
    readonly onOpen: (href: string) => void
}

/** The ready progress, checklist, draft, knowledge, versions and the last apply notice. */
export const AgentSetupBand = (props: AgentSetupBandProps) => {
    const { view, copy } = props
    return (
        <>
            <SetupMeter
                label={view.gates.title}
                valueLabel={view.gates.progressLabel}
                confirmed={view.gates.confirmed}
                total={view.gates.total}
                isLoading={props.isLoading}
            />
            <Text size="xs" tone="muted">
                {copy.feedNote}
            </Text>
            <Disclosure
                title={copy.checklistLabel}
                defaultExpanded={!view.gates.canApply}
                body={
                    <div className={LIST_MEASURE_CLASS_NAME}>
                        <Stack gap="row">
                            <AgentSetupChecklist
                                view={view}
                                isLoading={props.isLoading}
                                copy={{ ...copy, emptyLabel: props.emptyLabel }}
                                on={{
                                    gate: props.onGate,
                                    startEdit: props.onStartEdit,
                                    stopEdit: props.onStopEdit,
                                    editText: props.onEditText,
                                    open: props.onOpen,
                                }}
                            />
                            <SetupDraftCard {...view.draft} isLoading={props.isLoading} />
                            <SetupKnowledgeCard {...view.knowledge} isLoading={props.isLoading} />
                            <SetupVersionsCard {...view.versions} isLoading={props.isLoading} />
                        </Stack>
                    </div>
                }
            />
            {view.gates.applyTone === "idle" ? null : (
                <Alert title={view.gates.applyTitle} description={view.gates.applyText} tone="affirmative" />
            )}
        </>
    )
}
