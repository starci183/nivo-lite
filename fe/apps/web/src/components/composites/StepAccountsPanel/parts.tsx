import { Badge, Cluster, Stack, Sublabel, SurfaceCard, Text } from "@starci/grammar/common"
import type { StepAccountsView, StepAction } from "@/modules/types"

/** What a part of the section reads: the section's view. */
export interface ViewProps {
    readonly view: StepAccountsView
}

/** What the read-only effective rights read: the view and whether its data is read. */
interface EffectiveProps extends ViewProps {
    readonly isLoading: boolean
}

/** What a part of the section reads and where a change of it goes. */
export interface ActionProps extends ViewProps {
    readonly onAction: (action: StepAction) => void
}

/** What a part of the section reads, where a change of it goes, and whether its data is read. */
export interface EditProps extends EffectiveProps {
    readonly onAction: (action: StepAction) => void
}

/** What a titled group of the panel draws: its words, what it holds and the one small command at the end of its head row, when it has one. */
interface TitledProps {
    readonly title: string
    readonly hint: string
    readonly end?: React.ReactNode
    readonly body: React.ReactNode
}

/** A titled group of the panel: its Sublabel with the one line under it (the small command at the end of that row), then what it holds. */
export const Titled = (props: TitledProps) => (
    <Stack gap="row">
        <Cluster gap="inline" justify="between" align="center">
            <Stack gap="identity">
                <Sublabel>{props.title}</Sublabel>
                <Text tone="muted">{props.hint}</Text>
            </Stack>
            {props.end}
        </Cluster>
        {props.body}
    </Stack>
)

/** what the step can really do: read only, what the step can really do (the agent holds the account AND the step declares the operation). */
export const Effective = (props: EffectiveProps) => {
    const { view } = props
    if (view.effective.length === 0) return null
    return (
        <Titled
            title={view.effectiveTitle}
            hint={view.effectiveHint}
            body={
                <SurfaceCard
                    kind="list"
                    ariaLabel={view.effectiveTitle}
                    isLoading={props.isLoading}
                    empty={null}
                    items={view.effective.map((row) => ({
                        id: row.id,
                        title: row.title,
                        value: <Badge tone={row.isNone ? "muted" : "neutral"}>{row.chip}</Badge>,
                        ...(row.isNone ? { state: "unavailable" as const } : {}),
                    }))}
                />
            }
        />
    )
}
