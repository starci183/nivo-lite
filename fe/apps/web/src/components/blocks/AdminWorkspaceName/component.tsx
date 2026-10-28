/** The words of the workspace title. */
export interface AdminWorkspaceNameBaseProps {
    readonly props: { readonly text: string }
}

/** Draws the workspace name as plain text, to sit in the page header. */
export const AdminWorkspaceNameBase = (props: AdminWorkspaceNameBaseProps) => <>{props.props.text}</>
