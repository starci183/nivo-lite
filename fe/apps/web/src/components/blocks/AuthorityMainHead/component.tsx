import { PaneHead } from "@/components/composites/PaneHead"

/** The words of the open section's head and the way back to the list. */
export interface AuthorityMainHeadBaseProps {
    readonly props: { readonly title: string; readonly back: string }
    readonly on: { readonly back: () => void }
}

/** Draws the head of the main pane: the open section's name, with the way back to the list on a phone. */
export const AuthorityMainHeadBase = (props: AuthorityMainHeadBaseProps) => (
    <PaneHead title={props.props.title} headingLevel={2} back={{ label: props.props.back, onPress: props.on.back }} />
)
