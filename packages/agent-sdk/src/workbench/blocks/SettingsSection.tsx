import { Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** What one section of a module's settings draws. */
export interface SettingsSectionProps {
    readonly title: string
    readonly hint?: string
    readonly children: ReactNode
}

/** One titled card of a module's settings or setup step: an optional hint over the stacked fields. */
export const SettingsSection = (props: SettingsSectionProps): ReactNode => (
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
