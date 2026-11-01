import { Button, Cluster, EmptyNotice, FormGrid, SectionHeader, Select, Stack } from "@starci/grammar/common"
import type { AgentGraphAdderView } from "@/modules/types"

/** The two choices that add a decision point, and the commands that pick them and add it. */
interface AgentGraphAdderProps {
    readonly view: AgentGraphAdderView
    readonly isSkeleton: boolean
    readonly onPick: (field: "action" | "fact", value: string) => void
    readonly onAdd: (action: string, fact: string) => void
}

/**
 * Adds a decision point to an agent that has none: the owner picks which action it guards and on which fact (an amount, for
 * instance), and the draft gets a decision point with its branches to edit as rows. Nothing runs differently until it is published.
 */
export const AgentGraphAdder = (props: AgentGraphAdderProps) => {
    const { view } = props
    return (
        <Stack gap="section">
            <SectionHeader level={3} title={view.title} description={view.hint} isSkeleton={props.isSkeleton} />
            {view.blocked === "" ? (
                <>
                    <FormGrid columns={1}>
                        <Select
                            label={view.actionLabel}
                            options={view.actions.map((option) => ({ id: option.value, label: option.label }))}
                            value={view.action === "" ? null : view.action}
                            isSkeleton={props.isSkeleton}
                            onValueChange={(value) => props.onPick("action", value ?? "")}
                        />
                        <Select
                            label={view.factLabel}
                            options={view.facts.map((option) => ({ id: option.value, label: option.label }))}
                            value={view.fact === "" ? null : view.fact}
                            isSkeleton={props.isSkeleton}
                            onValueChange={(value) => props.onPick("fact", value ?? "")}
                        />
                    </FormGrid>
                    <Cluster gap="inline">
                        <Button
                            intent="commit"
                            size="sm"
                            isDisabled={view.action === "" || view.fact === ""}
                            isSkeleton={props.isSkeleton}
                            onPress={() => props.onAdd(view.action, view.fact)}
                        >
                            {view.addLabel}
                        </Button>
                    </Cluster>
                </>
            ) : (
                <EmptyNotice message={view.blocked} />
            )}
        </Stack>
    )
}
