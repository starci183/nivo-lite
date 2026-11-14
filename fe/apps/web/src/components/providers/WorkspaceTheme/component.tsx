import type { AppliedWorkspaceTheme } from "@/hooks/workspaceTheme"

/** The theme to draw. */
interface WorkspaceThemeBaseProps {
    readonly props: { readonly theme: AppliedWorkspaceTheme | null }
}

/** Draws the workspace's theme after `brand.css`: the chosen font's stylesheet and the `:root` / `.dark` overrides; nothing for the NIVO default. */
export const WorkspaceThemeBase = (props: WorkspaceThemeBaseProps) => {
    const theme = props.props.theme
    if (theme === null) return null
    return (
        <>
            {theme.fontHref === null ? null : <link rel="stylesheet" href={theme.fontHref} precedence="default" />}
            <style id="nivo-workspace-theme">{theme.css}</style>
        </>
    )
}
