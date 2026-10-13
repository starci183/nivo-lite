import { Badge } from "@starci/grammar/common"

/** What the chip says. */
interface AiMarkChipProps {
    /** The word of the chip, from the catalog. */
    readonly label: string
}

/**
 * Small "AI" chip that marks AI-prepared content; never the approval control itself.
 * A neutral Grammar Badge: "AI" is a category, not a status, and the Badge owns its paint.
 */
export const AiMarkChip = (props: AiMarkChipProps) => <Badge tone="neutral">{props.label}</Badge>
