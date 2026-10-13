import type { CatalogReader } from "@/hooks/connection-wizard"
import type { DbOutcome } from "@/modules/db/outcome"
import type { FirstEventState, MetaAuthorization, MetaCheck, MetaWizardConnection, WizardNote } from "@/modules/types"

/** The steps of the Meta wizard, in order. */
export const META_STEPS = ["connect", "pick", "agent", "test"] as const

/** The commands the connected entry hands the Meta wizard (each one already knows the active workspace). */
export interface MetaActions {
    readonly authorize: (connectionId: string | undefined) => Promise<DbOutcome<MetaAuthorization>>
    readonly resume: (connectionId: string) => Promise<DbOutcome<MetaWizardConnection>>
    readonly choosePage: (connectionId: string, pageId: string) => Promise<DbOutcome<MetaWizardConnection>>
    readonly check: (connectionId: string, repair: boolean) => Promise<DbOutcome<MetaCheck>>
    readonly setAgents: (connectionId: string, agents: ReadonlyArray<string>) => Promise<DbOutcome<true>>
    readonly checkFirstEvent: (connectionId: string) => Promise<DbOutcome<FirstEventState>>
}

/** The sentence for a login that did not end well, or null when it did (or there was none). */
export const metaFailureOf = (returned: string | undefined, m: CatalogReader): string | null => {
    if (returned === "denied") return m("authDenied")
    if (returned === "failed") return m("authFailed")
    if (returned === "expired") return m("authExpired")
    if (returned === "nopages") return m("authNoPages")
    return returned === "unavailable" ? m("authUnavailable") : null
}

/** Where a resumed connection continues: back to the login after a failure, on to the Page list once there is one, else where it stands. */
export const metaStartStepOf = (conn: MetaWizardConnection, failed: boolean): number => {
    if (failed) return 0
    if (conn.pages.length > 0) return 1
    return conn.pageId === "" ? 0 : 2
}

/** One line of the test step, in the owner's words. */
export interface MetaCheckLine {
    readonly key: string
    readonly tone: WizardNote["tone"]
    readonly text: string
}

const listOf = (items: ReadonlyArray<string>): string => items.join(", ")

/** One line per fact Meta reported. */
export const metaCheckLines = (check: MetaCheck, m: CatalogReader): ReadonlyArray<MetaCheckLine> => {
    if (!check.tokenOk) return [{ key: "token", tone: "negative", text: m("testToken") }]
    const lines: Array<MetaCheckLine> = []
    if (!check.page.subscribed) lines.push({ key: "page", tone: "negative", text: m("testPageNone") })
    else if (check.page.missing.length > 0) {
        lines.push({
            key: "page",
            tone: "negative",
            text: m("testPageMissing", { fields: listOf(check.page.missing) }),
        })
    } else
        lines.push({ key: "page", tone: "affirmative", text: m("testPageOk", { fields: listOf(check.page.fields) }) })
    const app = (key: string, object: string, found: MetaCheck["appPage"]) => {
        if (!check.appKnown) return
        if (found === null) lines.push({ key, tone: "negative", text: m("testAppNone", { object }) })
        else if (!found.urlMatches) {
            lines.push({ key, tone: "negative", text: m("testAppUrl", { object, url: found.callbackUrl }) })
        } else if (found.missing.length > 0) {
            lines.push({ key, tone: "negative", text: m("testAppMissing", { object, fields: listOf(found.missing) }) })
        } else lines.push({ key, tone: "affirmative", text: m("testAppOk", { object, fields: listOf(found.fields) }) })
    }
    app("app-page", m("testAppPage"), check.appPage)
    if (check.igUsername !== "") app("app-ig", m("testAppInstagram"), check.appInstagram)
    if (!check.appKnown)
        lines.push({ key: "app-unknown", tone: "informative", text: m("testAppUnknown", { url: check.webhookUrl }) })
    if (check.localOnly) lines.push({ key: "local", tone: "informative", text: m("testLocal") })
    if (!check.verifyTokenSet) lines.push({ key: "verify", tone: "negative", text: m("testNoVerify") })
    return lines
}
