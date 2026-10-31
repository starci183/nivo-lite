import { Badge, Cluster } from "@starci/grammar/common"

/** One state mark of a conversation. */
interface ChatbotChip {
    readonly id: string
    readonly label: string
    readonly tone: "warning" | "accent" | "neutral"
    readonly isDot: boolean
}

/** The channel a conversation came from and its state marks. */
interface ChatbotChipsProps {
    readonly channel: string
    readonly chips: ReadonlyArray<ChatbotChip>
}

/** The channel mark followed by who is replying and whether somebody is needed, on one wrapping line. */
export const ChatbotChips = (props: ChatbotChipsProps) => (
    <Cluster gap="identity">
        <Badge tone="neutral">{props.channel}</Badge>
        {props.chips.map((chip) => (
            <Badge key={chip.id} tone={chip.tone} isDot={chip.isDot}>
                {chip.label}
            </Badge>
        ))}
    </Cluster>
)
