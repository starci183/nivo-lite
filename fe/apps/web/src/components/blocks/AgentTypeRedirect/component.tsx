import { EmptyNotice, Page, SurfaceCard } from "@starci/grammar/common"
import { WaitingLines } from "@/components/composites/WaitingLines"
import type { WaitingLine } from "@/components/composites/WaitingLines"

/** The waiting lines the redirect draws while the target is found. */
export type AgentTypeRedirectLines = ReadonlyArray<WaitingLine>

/** Copy and lines of the waiting state. */
export interface AgentTypeRedirectBaseProps {
    readonly props: {
        readonly label: string
        /** The lines drawn as a skeleton until the redirect lands. */
        readonly lines: AgentTypeRedirectLines
        /** The type has no instance: what is said instead of the waiting lines, and the way back to the catalogue; null while the redirect decides. */
        readonly none: {
            readonly title: string
            readonly description: string
            readonly actionLabel: string
        } | null
    }
    readonly on: { readonly backToCatalog: () => void }
}

/** Draws waiting lines while the redirect of an old tab url is decided, or the way back to the catalogue when the type has no agent. */
export const AgentTypeRedirectBase = (props: AgentTypeRedirectBaseProps) => (
    <Page isLoading={props.props.none === null} measure="product" header={{ title: props.props.label }}>
        <SurfaceCard ariaLabel={props.props.label}>
            {props.props.none === null ? (
                <WaitingLines rows={props.props.lines} isLoading />
            ) : (
                <EmptyNotice
                    message={props.props.none.title}
                    description={props.props.none.description}
                    actionLabel={props.props.none.actionLabel}
                    onAction={props.on.backToCatalog}
                />
            )}
        </SurfaceCard>
    </Page>
)
