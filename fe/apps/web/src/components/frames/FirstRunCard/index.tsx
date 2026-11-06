import type { ReactNode } from "react"
import { Cluster, Heading, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { Collection } from "@starci/grammar/common"

/** What a first-run card draws: its question, the line under it, the body and the ways back and on. */
interface FirstRunCardHead {
    /** The accessible name of the card. */
    readonly title: string
    readonly heading: string
    readonly description: string
    /** The way back at the start, the way on at the end. */
    readonly actions: ReactNode
}

/** A step owns ordinary form content or a collection whose rows share the existing card. */
type FirstRunCardProps = FirstRunCardHead &
    (
        | { readonly children: ReactNode; readonly collection?: never }
        | { readonly collection: Collection; readonly children?: never }
    )

/** The question, its form or collection, and the unchanged back/forward controls. */
export const FirstRunCard = (props: FirstRunCardProps) => {
    const head = (
        <Stack gap="identity">
            <Heading level={1}>{props.heading}</Heading>
            <Text tone="muted">{props.description}</Text>
        </Stack>
    )
    const actions = (
        <Cluster gap="row" justify="between">
            {props.actions}
        </Cluster>
    )
    if (props.collection !== undefined) {
        return (
            <Stack gap="section" measure="form">
                <SurfaceCard
                    ariaLabel={props.title}
                    headers={[{ kind: "custom", children: head }]}
                    footers={[{ kind: "custom", children: actions }]}
                    {...props.collection}
                />
            </Stack>
        )
    }
    return (
        <SurfaceCard ariaLabel={props.title} measure="form">
            <Stack gap="section">
                {head}
                {props.children}
                {actions}
            </Stack>
        </SurfaceCard>
    )
}
