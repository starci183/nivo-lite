import { Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"

interface ContentSettingsCardProps {
    readonly title: string
    readonly description: string
    readonly children: ReactNode
}

/** The shared surface and heading of editable content settings. */
export const ContentSettingsCard = (props: ContentSettingsCardProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <Stack gap="row">
            <Text size="sm" tone="muted">
                {props.description}
            </Text>
            {props.children}
        </Stack>
    </SurfaceCard>
)
