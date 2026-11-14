import { Button, Cluster, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { PolicyDrawerProps } from "@/modules/types"

/** What the two bordered lists of the drawer read, and the two decisions on a proposal. */
interface PolicyVersionListsProps {
    readonly props: Pick<PolicyDrawerProps, "proposals" | "history" | "copy">
    readonly on: {
        readonly use: (proposalId: string) => void
        readonly reject: (proposalId: string) => void
    }
}

/** The 12 muted line under a row's name (a string line would be 14). */
const lineOf = (line: string) => (
    <Text as="span" size="xs" tone="muted">
        {line}
    </Text>
)

/** The proposals waiting on the rule, each with its two decisions under its value. */
const Proposals = (props: PolicyVersionListsProps) =>
    props.props.proposals.length === 0 ? null : (
        <SurfaceCard
            kind="list"
            label={props.props.copy.proposalsLabel}
            items={props.props.proposals.map((one) => ({
                id: one.id,
                title: one.value,
                description: lineOf(one.line),
                detail: (
                    <Cluster gap="inline">
                        <Button
                            intent="neutral"
                            size="sm"
                            isPending={one.isPending}
                            onPress={() => props.on.use(one.id)}
                        >
                            {props.props.copy.use}
                        </Button>
                        <Button
                            intent="neutral"
                            size="sm"
                            isDisabled={one.isPending}
                            onPress={() => props.on.reject(one.id)}
                        >
                            {props.props.copy.reject}
                        </Button>
                    </Cluster>
                ),
            }))}
            empty={null}
        />
    )

/**
 * The bordered lists of the policy drawer: the proposals waiting (the owner uses one or dismisses it) and the history of the rule,
 * newest version first, each version over its source and day.
 */
export const PolicyVersionLists = (props: PolicyVersionListsProps) => (
    <Stack gap="row">
        <Proposals {...props} />
        <SurfaceCard
            kind="list"
            label={props.props.copy.historyLabel}
            items={props.props.history.map((one) => ({ id: one.id, title: one.title, description: lineOf(one.line) }))}
            empty={
                <Text size="xs" tone="muted">
                    {props.props.copy.historyEmpty}
                </Text>
            }
        />
    </Stack>
)
