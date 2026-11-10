import type { ReactNode } from "react"
import { Heading, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** The words and body of one auth card. */
interface AuthPanelProps {
    readonly label: string
    readonly title: string
    /** The heading level: 1 when the card holds the page subject (default, the centred entry page has no other heading), 2 under a page heading. */
    readonly level?: 1 | 2
    readonly text?: string
    readonly children: ReactNode
    /** The words are still being read: the heading and the line draw as skeleton. */
    readonly isLoading?: boolean
}

/** The auth card: a heading over the form or message; the line of text sits under the card as its note. */
export const AuthPanel = (props: AuthPanelProps) => (
    <SurfaceCard
        ariaLabel={props.label}
        {...(props.text === undefined ? {} : { note: props.isLoading === true ? <Text isLoading>{props.text}</Text> : props.text })}
    >
        <Stack gap="region">
            <Heading level={props.level ?? 1} {...(props.isLoading === true ? { isLoading: true } : {})}>
                {props.title}
            </Heading>
            {props.children}
        </Stack>
    </SurfaceCard>
)
