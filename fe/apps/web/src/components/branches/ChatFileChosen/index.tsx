import { Cluster, IconButton, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The file that goes with the next message. */
interface ChatFileChosenProps {
    readonly name: string
    readonly removeLabel: string
    readonly isDisabled: boolean
    readonly onRemove: () => void
}

/** The name of the chosen file above the message field, with the button that takes it back. */
export const ChatFileChosen = (props: ChatFileChosenProps) => (
    <Cluster gap="inline" align="center" wrap={false}>
        <Text size="sm" tone="muted">
            {props.name}
        </Text>
        <IconButton
            intent="dismiss"
            source={nivoIconSource("close", "leading")}
            label={props.removeLabel}
            isDisabled={props.isDisabled}
            onPress={props.onRemove}
        />
    </Cluster>
)
