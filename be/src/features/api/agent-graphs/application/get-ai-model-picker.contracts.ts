/** What aiModelPicker takes. */
export interface GetAiModelPickerRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The language the choices are written in; Vietnamese unless en is named. */
    readonly locale: string | null | undefined
}
