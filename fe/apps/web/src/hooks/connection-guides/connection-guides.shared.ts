import type { Environment, Provider } from "@/modules/types"

/** What the wizard knows, to fill into copy values. */
export interface GuideContext {
    readonly name: string
    readonly webhookUrl: string
    readonly apiKey: string
    readonly bank: string
    readonly account: string
    readonly callbackUrl?: string
}

/** A value of the guide context the wizard shows for copying. */
export type Token = "webhookName" | "webhookUrl" | "apiKey" | "callbackUrl"

/**
 * One line of a provider screen: copy a value, make a choice, switch something on, paste a provider value, or a plain note.
 * The words are catalog keys (`guideKey`): the label and option exactly as the provider prints them, the rest translated.
 */
export type GuideItemDef =
    | { readonly kind: "copy"; readonly token: Token; readonly secret: boolean }
    | { readonly kind: "choose" }
    | { readonly kind: "switch" }
    | { readonly kind: "paste"; readonly field: string; readonly secret: boolean; readonly hasHint: boolean }
    | { readonly kind: "note" }

/** One screen of the provider: its id and its lines. */
export interface GuideStepDef {
    readonly id: string
    readonly items: ReadonlyArray<GuideItemDef>
}

/** How the owner proves the connection works: an optional link, and how many steps the catalog lists. */
export interface VerifyDef {
    readonly steps: number
    readonly url?: string
}

const copy = (token: Token, secret = false): GuideItemDef => ({ kind: "copy", token, secret })
const choose = (): GuideItemDef => ({ kind: "choose" })
const toggle = (): GuideItemDef => ({ kind: "switch" })
const paste = (field: string, secret = false, hasHint = false): GuideItemDef => ({
    kind: "paste",
    field,
    secret,
    hasHint,
})
const note = (): GuideItemDef => ({ kind: "note" })

/** The guided steps that mirror each provider own screens. */
export const GUIDES: Readonly<Partial<Record<Provider, ReadonlyArray<GuideStepDef>>>> = {
    sepay: [
        { id: "basic", items: [copy("webhookName"), copy("webhookUrl"), choose(), choose(), toggle()] },
        { id: "account", items: [choose()] },
        { id: "security", items: [choose(), copy("apiKey", true), note()] },
    ],
    payos: [
        { id: "channel", items: [choose(), choose(), note()] },
        { id: "keys", items: [paste("clientId"), paste("apiKey", true), paste("checksumKey", true)] },
        { id: "webhook", items: [copy("webhookUrl"), note()] },
    ],
    casso: [
        { id: "add", items: [choose(), choose(), choose(), choose()] },
        { id: "setup", items: [copy("webhookUrl"), paste("secureKey", true, true), note()] },
    ],
    telegram: [{ id: "botfather", items: [note(), choose(), note(), note()] }],
    zalo_oa: [
        { id: "app", items: [note(), choose(), note()] },
        { id: "link", items: [choose(), note(), copy("callbackUrl"), note()] },
        { id: "webhook", items: [copy("webhookUrl"), toggle(), toggle(), paste("oaSecret", true, true)] },
    ],
    webhook: [{ id: "n8n", items: [note()] }],
}

/** The first-event help of each provider, per environment. */
export const VERIFY: Readonly<Partial<Record<Provider, Partial<Record<Environment, VerifyDef>>>>> = {
    sepay: { test: { steps: 3, url: "https://my.sepay.vn/testmode/webhook" }, live: { steps: 1 } },
    payos: { live: { steps: 2 } },
    casso: { live: { steps: 1 } },
}

/** The catalog key of a step title or of one part of a guide line (`index` is the line inside the step). */
export const guideKey = (
    provider: Provider,
    step: string,
    index: number | null,
    part: "title" | "label" | "option" | "state" | "hint" | "text",
): string => (index === null ? `guide_${provider}_${step}_title` : `guide_${provider}_${step}_${index}_${part}`)

/** The catalog key of the intro (`index` null) or of one step of the first-event help. */
export const verifyKey = (provider: Provider, environment: Environment, index: number | null): string =>
    index === null ? `verify_${provider}_${environment}_intro` : `verify_${provider}_${environment}_${index}`

/** Replace {name} {bank} {account} in a guide or help string. */
export const fill = (text: string, ctx: Pick<GuideContext, "bank" | "account" | "name">): string =>
    text.replace(/\{(bank|account|name)\}/g, (_, key: "bank" | "account" | "name") => ctx[key])

/** The value a copy line shows. */
export const tokenValue = (token: Token, ctx: GuideContext): string => {
    if (token === "webhookName") return `NIVO · ${ctx.name}`
    if (token === "webhookUrl") return ctx.webhookUrl
    if (token === "callbackUrl") return ctx.callbackUrl ?? ""
    return ctx.apiKey
}
