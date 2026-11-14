import type { InjectionToken } from "@nestjs/common"

/** What the workspace settings take from the app root. */
export interface WorkspaceSettingsOptions {
    /**
     * Provider token of a WorkspaceLogos implementation (the avatars service). Given in the app that serves people (the api): it then
     * also registers the door people change the settings through, which needs the members capability and the logo store. The
     * store-only apps (cli, mcp) give none and read the settings and the time zone only.
     */
    readonly logos?: InjectionToken
}
