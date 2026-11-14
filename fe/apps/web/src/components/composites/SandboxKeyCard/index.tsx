import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import { sandboxCardStateOf } from "@/components/branches/SandboxCardState"
import type { SandboxCopy, SandboxKeyView, SandboxPendingView } from "@/modules/types"

/** What the key card draws and does. */
interface SandboxKeyCardProps {
    readonly copy: SandboxCopy
    readonly view: SandboxKeyView
    readonly pending: SandboxPendingView
    readonly on: {
        readonly reveal: () => void
        readonly hide: () => void
        readonly copy: () => void
        readonly retry: () => void
    }
}

/** What stands in the place of a key that is not shown. */
const MASK = "••••••••••••••••"

/**
 * The webhook key of the open account as one row: the key hidden behind dots until the owner asks to see it, the way to show or hide
 * it and the neutral command that copies it, with the one muted line that says where it goes. The key is read for the copy command
 * and is drawn only while revealed.
 */
export const SandboxKeyCard = (props: SandboxKeyCardProps) => {
    const state = sandboxCardStateOf(props.view.value, MASK, "", {
        message: props.copy.webhookKey.errorTitle,
        retryLabel: props.copy.retryLabel,
        onRetry: props.on.retry,
    })
    const isShown = props.view.isRevealed && !state.isLoading && state.data !== ""
    return (
        <SurfaceCard
            kind="list"
            label={props.copy.webhookKey.title}
            headingLevel={2}
            isLoading={state.isLoading}
            {...(state.error === undefined ? {} : { error: state.error })}
            items={[
                {
                    id: "webhook-key",
                    title: isShown ? state.data : MASK,
                    description: (
                        <Text as="span" size="xs" tone="muted">
                            {props.copy.webhookKey.hint}
                        </Text>
                    ),
                    actionPlacement: "end",
                    action: {
                        label: props.view.isRevealed
                            ? props.copy.webhookKey.hideLabel
                            : props.copy.webhookKey.revealLabel,
                        press: props.view.isRevealed ? props.on.hide : props.on.reveal,
                    },
                    control: (
                        <Button
                            intent="neutral"
                            size="sm"
                            isDisabled={state.data === ""}
                            isPending={props.pending.isCopying}
                            onPress={props.on.copy}
                        >
                            {props.copy.webhookKey.copyLabel}
                        </Button>
                    ),
                },
            ]}
            empty={<Text tone="muted">{props.copy.webhookKey.hint}</Text>}
        />
    )
}
