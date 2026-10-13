import type { ReactNode } from "react"
import { Heading, SurfaceCard, SurfaceCopyGroup, Text } from "@starci/grammar/common"
import { AUTH_STACK_CLASS_NAME } from "./classNames"

/** The words and body of one auth card. */
interface AuthPanelProps {
    readonly label: string
    readonly title: string
    readonly text?: string
    readonly children: ReactNode
}

/** The auth card: a heading, an optional line of text and the form or message below them. */
export const AuthPanel = (props: AuthPanelProps) => (
    <SurfaceCard ariaLabel={props.label}>
        <div className={AUTH_STACK_CLASS_NAME}>
            <SurfaceCopyGroup>
                <Heading level={2}>{props.title}</Heading>
                {props.text === undefined ? null : <Text tone="muted">{props.text}</Text>}
            </SurfaceCopyGroup>
            {props.children}
        </div>
    </SurfaceCard>
)
