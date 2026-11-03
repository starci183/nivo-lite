import type { ReactNode } from "react"
import { Stack, Text } from "@starci/grammar/common"

/** The actual ready audience count, segment and optional sample. */
interface LoyaltyPromoPreviewProps {
    readonly lines: ReadonlyArray<{ readonly id: string; readonly text: string; readonly emphasis: boolean }>
    readonly isLoading: boolean
}

/** Draws the existing audience lines in their original reading order and emphasis. */
export const LoyaltyPromoPreview = (props: LoyaltyPromoPreviewProps): ReactNode => (
    <Stack gap="row">
        {props.lines.map((line) => (
            <Text
                key={line.id}
                size={line.emphasis ? "md" : "xs"}
                isStrong={line.emphasis}
                tone={line.emphasis ? "default" : "muted"}
                isLoading={props.isLoading}
            >
                {line.text}
            </Text>
        ))}
    </Stack>
)
