import { Alert } from "@starci/grammar/common"

/** The words of the view-only note staff see. */
export interface AuthorityReadOnlyBaseProps {
    readonly props: { readonly title: string; readonly body: string }
}

/** Draws the note that says staff may read the authority but not change it. */
export const AuthorityReadOnlyBase = (props: AuthorityReadOnlyBaseProps) => (
    <Alert tone="cautionary" title={props.props.title} description={props.props.body} />
)
