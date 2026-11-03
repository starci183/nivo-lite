import type { ReactNode } from "react"
import { Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** The heading and hint of a setup card of the shifts screens, and what sits under them. */
interface ShiftsSetupCardProps {
    readonly title: string
    readonly hint: string
    readonly body: ReactNode
    readonly isLoading: boolean | undefined
}

/** A setup card of the shifts screens: its title, a muted hint and the body under it. */
export const ShiftsSetupCard = (props: ShiftsSetupCardProps) => (
    <SurfaceCard
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        label={props.title}
        headingLevel={2}
    >
        <Stack gap="row">
            <Text {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })} size="sm" tone="muted">
                {props.hint}
            </Text>
            {props.body}
        </Stack>
    </SurfaceCard>
)
