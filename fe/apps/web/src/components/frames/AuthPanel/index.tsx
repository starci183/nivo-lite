import type { ReactNode } from "react"
import { Heading, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** The words and body of one auth card. */
interface AuthPanelProps {
    readonly label: string
    readonly title: string
    /** The heading level: 2 under a page heading (default), 1 when the card holds the page subject. */
    readonly level?: 1 | 2
    readonly text?: string
    readonly children: ReactNode
    /** The words are still being read: the heading and the line draw as skeleton. */
    readonly isLoading?: boolean
}

/** The auth card: a heading, an optional line of text and the form or message below them. */
export const AuthPanel = (props: AuthPanelProps) => {
    const loading = props.isLoading === true ? { isLoading: true } : {}
    return (
        <SurfaceCard ariaLabel={props.label}>
            <Stack gap="region">
                <Stack gap="inline">
                    <Heading level={props.level ?? 2} {...loading}>
                        {props.title}
                    </Heading>
                    {props.text === undefined ? null : (
                        <Text tone="muted" {...loading}>
                            {props.text}
                        </Text>
                    )}
                </Stack>
                {props.children}
            </Stack>
        </SurfaceCard>
    )
}
