import { Badge, Button } from "@starci/grammar/common"
import type { AgentGraphHeadView } from "@/modules/types"

/** The publish control of the progress card: the view of the head and the command that makes the draft the running version. */
type AgentGraphPublishProps = {
    readonly view: AgentGraphHeadView
    readonly isLoading: boolean
    readonly onPublish: () => void
}

/** "Publish and run" as the one primary while the draft has something to publish; "Version N is running" when it has not. */
export const AgentGraphPublish = (props: AgentGraphPublishProps) => {
    if (props.view.runningLabel !== "") {
        return (
            <Badge tone="success" isLoading={props.isLoading}>
                {props.view.runningLabel}
            </Badge>
        )
    }
    return (
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
    )
}
