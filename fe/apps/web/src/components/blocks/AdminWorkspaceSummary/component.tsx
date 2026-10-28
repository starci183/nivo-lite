/** The words of the workspace description. */
export interface AdminWorkspaceSummaryBaseProps {
    readonly props: { readonly text: string }
}

/** Draws the line with its owner, creation date and id as plain text, to sit in the page header. */
export const AdminWorkspaceSummaryBase = (props: AdminWorkspaceSummaryBaseProps) => <>{props.props.text}</>
