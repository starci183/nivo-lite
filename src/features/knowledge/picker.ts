/**
 * Google Picker with the drive.file scope (the customer path: the owner picks the files, NIVO never gets a restricted scope).
 * Browser only. The two Google scripts load on the first click. The token comes from the Google Identity Services token client, lives in
 * memory for the picked rows and is sent to our server actions with them; it is never stored.
 * Needs three PUBLIC values (inlined at build time): NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_PICKER_API_KEY, NEXT_PUBLIC_GOOGLE_APP_ID.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? ""
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? ""
const SCOPE = "https://www.googleapis.com/auth/drive.file"

/** False hides the button: any of the three values missing. */
export const pickerConfigured = (): boolean => Boolean(CLIENT_ID && API_KEY && APP_ID)

export type PickedDoc = { readonly id: string; readonly name: string; readonly mimeType: string }
export type PickResult = { readonly token: string; readonly docs: ReadonlyArray<PickedDoc> }

type Loose = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- Google's scripts ship no bundled types
const win = (): Loose => window as unknown as Loose

const scripts = new Map<string, Promise<void>>()
const loadScript = (src: string): Promise<void> => {
  const known = scripts.get(src)
  if (known) return known
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script")
    el.src = src
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => { scripts.delete(src); reject(new Error("script")) }
    document.head.appendChild(el)
  })
  scripts.set(src, p)
  return p
}

let pickerLib: Promise<void> | null = null
const loadPickerLib = (): Promise<void> => {
  pickerLib ??= new Promise<void>((resolve, reject) => {
    const gapi = win().gapi as Loose | undefined
    if (!gapi) { reject(new Error("gapi")); return }
    gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("picker")) })
  }).catch((e) => { pickerLib = null; throw e })
  return pickerLib
}

// The Picker is appended to <body>, outside the drawer: keep it above the drawer's overlay.
const STYLE_ID = "nivo-picker-z"
const raisePicker = (): void => {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement("style")
  s.id = STYLE_ID
  s.textContent = ".picker-dialog-bg{z-index:2147483000 !important}.picker-dialog{z-index:2147483001 !important}"
  document.head.appendChild(s)
}

const accessToken = (): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const oauth2 = (win().google as Loose | undefined)?.accounts?.oauth2 as Loose | undefined
    if (!oauth2) { reject(new Error("gis")); return }
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r: Loose) => (typeof r.access_token === "string" && !r.error ? resolve(r.access_token) : reject(new Error(String(r.error ?? "token")))),
      error_callback: (e: Loose) => reject(new Error(String(e?.type ?? "popup"))),
    })
    client.requestAccessToken({ prompt: "" })
  })

/** Opens the picker. Resolves null when the owner cancels or closes the consent popup; rejects when Google could not be reached. */
export const pickFromDrive = async (): Promise<PickResult | null> => {
  if (!pickerConfigured()) throw new Error("not configured")
  await Promise.all([loadScript("https://apis.google.com/js/api.js"), loadScript("https://accounts.google.com/gsi/client")])
  await loadPickerLib()
  let token: string
  try { token = await accessToken() } catch (e) {
    const why = e instanceof Error ? e.message : ""
    if (why === "popup_closed" || why === "popup_failed_to_open" || why === "access_denied") return null
    throw e
  }
  raisePicker()
  const picker = (win().google as Loose).picker as Loose
  const folders = (view: Loose) => view.setIncludeFolders(true).setSelectFolderEnabled(true)
  const mine = folders(new picker.DocsView())
  const shared = folders(new picker.DocsView()).setEnableDrives(true)
  return new Promise<PickResult | null>((resolve) => {
    const built = new picker.PickerBuilder()
      .setAppId(APP_ID)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .addView(mine)
      .addView(shared)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .enableFeature(picker.Feature.SUPPORT_DRIVES)
      .setCallback((data: Loose) => {
        if (data.action === picker.Action.PICKED) {
          const docs = ((data.docs ?? []) as Array<Loose>)
            .filter((d) => typeof d.id === "string")
            .map((d): PickedDoc => ({ id: String(d.id), name: String(d.name ?? d.id), mimeType: String(d.mimeType ?? "") }))
          resolve({ token, docs })
        } else if (data.action === picker.Action.CANCEL) resolve(null)
      })
      .build()
    built.setVisible(true)
  })
}
