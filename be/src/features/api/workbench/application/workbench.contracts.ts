import type { Locale } from "@modules/platform/i18n"

/** The call of a screen to the workbench door: the selected workspace, the id of the read or action and its JSON text. */
export interface WorkbenchRequest {
    /** The workspace selected in the request header; membership is proved by the door capability. */
    readonly workspaceId: string
    /** The id of the read or action, `<module>.<name>`. */
    readonly name: string
    /** The variables of a read or the input of an action, as JSON text. */
    readonly payload: string
    /** The language of the viewer, from the request header. */
    readonly locale: Locale
}
