import { Button, Cluster, EmptyNotice, Section, Select, Grid } from "@starci/grammar/common"
import type { AgentGraphAdderView } from "@/modules/types"

/** The two choices that add a decision point, and the commands that pick them and add it. */
interface AgentGraphAdderProps {
    readonly view: AgentGraphAdderView
    readonly isLoading: boolean
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
        <Section headingLevel={3} title={view.title} description={view.hint} isLoading={props.isLoading}>
            {view.blocked === "" ? (
                <>
                    <Grid kind="form" columns={1}>
                        <Select
                            label={view.actionLabel}
                            options={view.actions.map((option) => ({ id: option.value, label: option.label }))}
                            value={view.action === "" ? null : view.action}
                            isLoading={props.isLoading}
                            onValueChange={(value) => props.onPick("action", value ?? "")}
                        />
                        <Select
                            label={view.factLabel}
                            options={view.facts.map((option) => ({ id: option.value, label: option.label }))}
                            value={view.fact === "" ? null : view.fact}
                            isLoading={props.isLoading}
                            onValueChange={(value) => props.onPick("fact", value ?? "")}
                        />
                    </Grid>
                    <Cluster gap="inline">
                        <Button
                            intent="commit"
                            size="sm"
                            isDisabled={view.action === "" || view.fact === ""}
                            isLoading={props.isLoading}
                            onPress={() => props.onAdd(view.action, view.fact)}
                        >
                            {view.addLabel}
                        </Button>
                    </Cluster>
                </>
            ) : (
                <EmptyNotice message={view.blocked} />
            )}
        </Section>
    )
}
