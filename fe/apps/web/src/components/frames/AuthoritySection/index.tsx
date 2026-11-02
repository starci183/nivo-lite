import type { ReactNode } from "react"
import { Cluster, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** The words and state every authority section shares. */
export interface AuthoritySectionView {
    readonly title: string
    readonly description: string
    readonly saveLabel: string
    readonly isPending: boolean
    /** Staff see the section but cannot change it: the controls do not take focus. */
    readonly isLocked: boolean
}

/** Props for AuthoritySection. */
type AuthoritySectionProps = {
    readonly section: AuthoritySectionView
    /** The connected section owns the save command and its pending or read state. */
    readonly footer: ReactNode
    readonly children: ReactNode
}

/** An authority settings card: its description, its fields and one primary save. */
export const AuthoritySection = (props: AuthoritySectionProps) => (
    <SurfaceCard label={props.section.title} headingLevel={2}>
        <div inert={props.section.isLocked}>
            <Stack gap="section">
                <Text size="sm" tone="muted">
                    {props.section.description}
                </Text>
                {props.children}
                <Cluster gap="row" justify="end">
                    {props.footer}
                </Cluster>
            </Stack>
        </div>
    </SurfaceCard>
)
