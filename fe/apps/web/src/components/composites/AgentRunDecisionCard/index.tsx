import { Button, Cluster, Stack, Sublabel, SurfaceCard } from "@starci/grammar/common"
import type { RunDecisionView } from "@/modules/types"

/** The words of the card of the decision a run waits on. */
export interface AgentRunDecisionCopy {
    readonly group: string
    readonly term: string
    readonly approve: string
    readonly retry: string
    readonly reject: string
}

/** What the card draws and what it does. */
interface AgentRunDecisionCardProps {
    readonly props: {
        readonly copy: AgentRunDecisionCopy
        readonly decision: RunDecisionView
        readonly isDeciding: boolean
    }
    readonly on: {
        readonly decide: (verdict: "approve" | "retry" | "reject") => void
    }
}

/**
 * The decision a run waits on: what is decided, with the positive answer (approve, or retry for work that only wants another try)
 * as the one primary of the page and the reject answer as neutral. It only draws: the page reads the decision and answers it.
 */
export const AgentRunDecisionCard = (props: AgentRunDecisionCardProps) => {
    const { copy, decision, isDeciding } = props.props
    return (
        <Stack gap="inline">
            <Sublabel>{copy.group}</Sublabel>
            <SurfaceCard
                kind="details"
                ariaLabel={copy.group}
                items={[{ id: "decision", term: copy.term, description: decision.title }]}
                footers={[
                    {
                        kind: "custom" as const,
                        children: (
                            <Cluster gap="inline">
                                <Button intent="commit" isPending={isDeciding} onPress={() => props.on.decide(decision.positive)}>
                                    {decision.positive === "retry" ? copy.retry : copy.approve}
                                </Button>
                                <Button intent="neutral" isDisabled={isDeciding} onPress={() => props.on.decide("reject")}>
                                    {copy.reject}
                                </Button>
                            </Cluster>
                        ),
                    },
                ]}
            />
        </Stack>
    )
}
