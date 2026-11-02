import { Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** What one section of the programme settings draws. */
type LoyaltySettingsSectionProps = {
    readonly title: string
    readonly hint?: string
    readonly children: ReactNode
}

/** One titled card of the programme settings: an optional hint over the stacked fields. */
export const LoyaltySettingsSection = (props: LoyaltySettingsSectionProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <Stack gap="row">
            {props.hint === undefined ? null : (
                <Text size="sm" tone="muted">
                    {props.hint}
                </Text>
            )}
            <Stack gap="row">{props.children}</Stack>
        </Stack>
    </SurfaceCard>
)
