import { Button, Cluster, Stack, Textarea } from "@starci/grammar/common"

/** The current reply draft and the atomic commands of its mounted editor. */
interface ChatbotReplyEditorProps {
    readonly text: string
    readonly label: string
    readonly sendLabel: string
    readonly cancelLabel: string
    readonly isBusy: boolean
    readonly onDraft: (value: string) => void
    readonly onSend: () => void
    readonly onCancel: () => void
}

/** The original reply editor: its draft field followed by send and cancel. */
export const ChatbotReplyEditor = (props: ChatbotReplyEditorProps) => (
    <Stack gap="inline">
        <Textarea
            label={props.label}
            rows={4}
            value={props.text}
            isDisabled={props.isBusy}
            onValueChange={props.onDraft}
        />
        <Cluster gap="inline">
            <Button
                intent="alternative"
                size="sm"
                isPending={props.isBusy}
                isDisabled={props.text.trim() === ""}
                onPress={props.onSend}
            >
                {props.sendLabel}
            </Button>
            <Button intent="neutral" size="sm" isDisabled={props.isBusy} onPress={props.onCancel}>
                {props.cancelLabel}
            </Button>
        </Cluster>
    </Stack>
)
