"use client"

import { useAppliedWebsiteTheme, useAppliedWorkspaceTheme } from "@/hooks/workspaceTheme"
import { WorkspaceThemeBase } from "./component"

/**
 * Wears the workspace's own theme on the console: reads the saved theme (any member), draws its overrides after `brand.css` and loads the
 * chosen font. A workspace with no theme draws nothing, so `brand.css` (the NIVO default) stays. The last theme is kept in the browser and
 * the layout's boot script paints it before the first read answers (the front end holds no server session, so the server cannot read the
 * theme; only a first visit shows the NIVO colours for a moment).
 */
export const WorkspaceTheme = () => <WorkspaceThemeBase props={{ theme: useAppliedWorkspaceTheme() }} />

/** The key of the hosted page whose workspace theme the page wears. */
interface WebsiteThemeProps {
    readonly siteKey: string
}

/** Wears the theme of the workspace behind a site key on its hosted page (anonymous read); the NIVO colours stay while it has none. */
export const WebsiteTheme = (props: WebsiteThemeProps) => (
    <WorkspaceThemeBase props={{ theme: useAppliedWebsiteTheme(props.siteKey) }} />
)
