import type { Locale } from "@modules/platform/i18n"

/** What installing a module takes. */
export interface InstallRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The module to install. */
    readonly moduleKey: string
    /** The language of the names and the welcome. */
    readonly locale: Locale
    /** True to add another instance of a type that allows several; false to install the type once. */
    readonly newInstance: boolean
    /** The label of the instance; the next free one when absent. */
    readonly name: string | null
}

/** What installing a module answers. */
export interface InstallResult {
    /** The installation. */
    readonly installationId: string
    /** The agent of the instance. */
    readonly agentId: string | null
    /** False when the module was installed already and the call only answered it. */
    readonly created: boolean
}
