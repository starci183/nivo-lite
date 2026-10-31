/** One file or folder the owner chose in Google Picker. */
export interface PickedDoc {
    readonly id: string
    readonly name: string
    readonly mimeType: string
    readonly url: string
    readonly sizeBytes: number | null
    readonly modifiedTime: string | null
}

/** What the owner chose, with the short-lived browser token Picker was opened with. The token is used for one call and never stored. */
export interface PickedChoice {
    readonly token: string
    readonly docs: ReadonlyArray<PickedDoc>
}

/** How one opening of Picker ended: something was chosen, the owner closed it, or Google's scripts could not run. */
export type PickerOutcome =
    | { readonly kind: "chosen"; readonly choice: PickedChoice }
    | { readonly kind: "closed" }
    | { readonly kind: "failed" }

/** The public settings Picker needs. */
interface PickerSettings {
    readonly apiKey: string
    readonly clientId: string
}

const API_SCRIPT = "https://apis.google.com/js/api.js"
const IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client"
const READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
const FOLDER_MIME = "application/vnd.google-apps.folder"

/** Google's scripts expose untyped globals, so the Picker is driven through guarded reads and calls and never through a cast. */
const member = (host: unknown, key: string): unknown =>
    typeof host === "object" && host !== null ? Reflect.get(host, key) : undefined

const call = (host: unknown, key: string, ...args: ReadonlyArray<unknown>): unknown => {
    const method = member(host, key)
    return typeof method === "function" ? Reflect.apply(method, host, args) : undefined
}

const construct = (host: unknown, key: string, ...args: ReadonlyArray<unknown>): unknown => {
    const ctor = member(host, key)
    return typeof ctor === "function" ? Reflect.construct(ctor, args) : undefined
}

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const loaded = new Map<string, Promise<void>>()

/** Loads one Google script once for the whole page. */
const loadScript = (src: string): Promise<void> => {
    const known = loaded.get(src)
    if (known !== undefined) return known
    const pending = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script")
        script.src = src
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => {
            loaded.delete(src)
            reject(new Error(src))
        }
        document.head.append(script)
    })
    loaded.set(src, pending)
    return pending
}

/** Asks Google for a read-only access token for this browser, through the sign-in the owner already has. */
const requestToken = (clientId: string): Promise<string> =>
    new Promise<string>((resolve, reject) => {
        const oauth2 = member(member(window, "google"), "accounts")
        const client = call(member(oauth2, "oauth2"), "initTokenClient", {
            client_id: clientId,
            scope: READ_SCOPE,
            callback: (answer: unknown) => {
                const token = text(member(answer, "access_token"))
                if (token === "") reject(new Error("token"))
                else resolve(token)
            },
            error_callback: () => reject(new Error("token")),
        })
        call(client, "requestAccessToken", { prompt: "" })
    })

const docOf = (doc: unknown): PickedDoc => {
    const size = Number(member(doc, "sizeBytes"))
    const modified = member(doc, "lastEditedUtc")
    return {
        id: text(member(doc, "id")),
        name: text(member(doc, "name")),
        mimeType: text(member(doc, "mimeType")),
        url: text(member(doc, "url")),
        sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
        modifiedTime: typeof modified === "number" ? new Date(modified).toISOString() : null,
    }
}

/** Whether a chosen item is a Drive folder. */
export const isPickedFolder = (doc: PickedDoc): boolean => doc.mimeType === FOLDER_MIME

/** Opens Picker on the owner's Drive and answers what was chosen once the owner picks or closes it. */
const showPicker = async (settings: PickerSettings): Promise<PickedChoice | null> => {
    await Promise.all([loadScript(API_SCRIPT), loadScript(IDENTITY_SCRIPT)])
    await new Promise<void>((resolve) => {
        call(member(window, "gapi"), "load", "picker", () => resolve())
    })
    const token = await requestToken(settings.clientId)
    const picker = member(member(window, "google"), "picker")
    const viewId = member(member(picker, "ViewId"), "DOCS")
    const view = construct(picker, "DocsView", viewId)
    call(view, "setIncludeFolders", true)
    call(view, "setSelectFolderEnabled", true)
    return new Promise<PickedChoice | null>((resolve) => {
        const builder = construct(picker, "PickerBuilder")
        call(builder, "addView", view)
        call(builder, "setOAuthToken", token)
        call(builder, "setDeveloperKey", settings.apiKey)
        call(builder, "enableFeature", member(member(picker, "Feature"), "MULTISELECT_ENABLED"))
        call(builder, "setCallback", (data: unknown) => {
            const action = member(data, "action")
            const actions = member(picker, "Action")
            if (action === member(actions, "CANCEL")) return resolve(null)
            if (action !== member(actions, "PICKED")) return
            const docs = member(data, "docs")
            resolve({ token, docs: Array.isArray(docs) ? docs.map(docOf) : [] })
        })
        call(call(builder, "build"), "setVisible", true)
    })
}

/**
 * Opens Google Picker on the owner's Drive (folders can be chosen, so can files). The token it asked for goes back with the choice for
 * one listing call; this app stores none. A script that cannot load, or a sign-in the owner refuses, is a `failed` outcome to word.
 */
export const openDrivePicker = async (settings: PickerSettings): Promise<PickerOutcome> => {
    try {
        const choice = await showPicker(settings)
        return choice === null ? { kind: "closed" } : { kind: "chosen", choice }
    } catch {
        return { kind: "failed" }
    }
}
