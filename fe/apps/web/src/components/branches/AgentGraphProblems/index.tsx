import { Alert, Button, Cluster, Disclosure, Stack, Text } from "@starci/grammar/common"
import type { AgentGraphProblemsView } from "@/modules/types"

/** What is wrong with the draft, and the commands that open the step it is about or the page where a right is given. */
interface AgentGraphProblemsProps {
    readonly view: AgentGraphProblemsView
    readonly onOpen: (nodeKey: string) => void
    readonly onGrants: () => void
}

/** One problem: its words, and the keys that open the step it is about or the page where the right is given. */
interface ProblemLineProps extends AgentGraphProblemsProps {
    readonly item: AgentGraphProblemsView["items"][number]
}

const ProblemLine = (props: ProblemLineProps) => (
    <Stack gap="inline">
        <Text size="sm">{props.item.text}</Text>
        <Cluster gap="inline">
            <Button intent="neutral" size="sm" onPress={() => props.onOpen(props.item.nodeKey)}>
                {props.view.openLabel}
            </Button>
            {props.item.isGrant ? (
                <Button intent="alternative" size="sm" onPress={props.onGrants}>
                    {props.view.grantLabel}
                </Button>
            ) : null}
        </Cluster>
    </Stack>
)

/**
 * Everything the checks of the back end found in the draft, in plain words, with the step each is about: the owner reads the first
 * at once, so the map stays in view, and opens the rest from a fold. It draws nothing when the draft is clear.
 */
export const AgentGraphProblems = (props: AgentGraphProblemsProps) => {
    const [first, ...rest] = props.view.items
    return first === undefined ? null : (
        <Alert
            title={props.view.title}
            tone="cautionary"
            appearance="soft"
            description={
                <Stack gap="row">
                    <ProblemLine {...props} item={first} />
                    {rest.length === 0 ? null : (
                        <Disclosure title={props.view.moreLabel}>
                            <Stack gap="row">
                                {rest.map((item) => (
                                    <ProblemLine key={item.id} {...props} item={item} />
                                ))}
                            </Stack>
                        </Disclosure>
                    )}
                </Stack>
            }
        />
    )
}
