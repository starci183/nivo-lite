import type { Locale } from "@modules/platform/i18n"

/** What installing a module takes. */
export interface InstallModuleRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The module to install. */
    readonly moduleKey: string
    /** The language of the names and the generated text. */
    readonly locale: Locale
    /** True to add another instance of a type that allows several. */
    readonly newInstance: boolean
    /** The label of the instance; the next free one when absent. */
    readonly name: string | null
}
