import { ResponsibilitiesBoard } from "@/components/blocks/ResponsibilitiesBoard"
import type { InitialFilters } from "@/hooks/responsibilities"

/** What the responsibilities page supplies: the filters the link preselected. */
export interface ResponsibilitiesPageBaseProps {
    readonly props: { readonly initial: InitialFilters }
}

/** Draws the responsibilities page: the connected board, keyed by its preselected filters so a new link starts afresh. */
export const ResponsibilitiesPageBase = (props: ResponsibilitiesPageBaseProps) => (
    <ResponsibilitiesBoard
        key={`${props.props.initial.status}-${props.props.initial.due}`}
        initial={props.props.initial}
    />
)
