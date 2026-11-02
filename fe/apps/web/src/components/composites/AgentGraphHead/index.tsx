import { Badge, Button, Cluster, Section } from "@starci/grammar/common"
import type { AgentGraphHeadView } from "@/modules/types"

/** The band over the graph: its title, where it stands and the command that makes the draft the running version. */
type AgentGraphHeadProps = {
    readonly view: AgentGraphHeadView
    readonly isLoading: boolean
    readonly onPublish: () => void
}

/** The title of the work map with its status line, the version and mode marks, and "Publish version N". */
export const AgentGraphHead = (props: AgentGraphHeadProps) => (
    <Section
        headingLevel={2}
        title={props.view.title}
        description={props.view.status}
        isLoading={props.isLoading}
        action={
            <Button
                intent="commit"
                size="sm"
                isLoading={props.isLoading}
                isPending={props.view.isPublishing}
                isDisabled={props.view.publishBlocked !== ""}
                {...(props.view.publishBlocked === "" ? {} : { disabledReason: props.view.publishBlocked })}
                onPress={props.onPublish}
            >
                {props.view.publishLabel}
            </Button>
        }
    >
        <Cluster gap="inline">
            {props.view.badges.map((badge) => (
                <Badge key={badge.text} tone={badge.tone} isLoading={props.isLoading}>
                    {badge.text}
                </Badge>
            ))}
        </Cluster>
    </Section>
)
