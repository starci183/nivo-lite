import type { Dispatch, SetStateAction, TransitionStartFunction } from "react"
import type { useTranslations } from "next-intl"
import type { CatalogReader } from "@/hooks/connection-wizard"
import type { useSetConnectionAgents } from "@/hooks/connections"
import type { MetaCheck, MetaWizardConnection, WizardNote } from "@/modules/types"
import type { MetaCommands } from "./useMetaCommands"

/** The steps of the Meta wizard, in order. */
export const META_STEPS = ["connect", "pick", "agent", "test"] as const

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

/** The resolved inputs for meta wizard actions input. */
interface MetaWizardActionsInput {
    readonly setNote: Dispatch<SetStateAction<WizardNote | null>>
    readonly setIndex: Dispatch<SetStateAction<number>>
    readonly conn: MetaWizardConnection | null
    readonly startChecking: TransitionStartFunction
    readonly commands: MetaCommands
    readonly setCheck: Dispatch<SetStateAction<MetaCheck | null>>
    readonly startTransition: TransitionStartFunction
    readonly pageId: string
    readonly tm: ReturnType<typeof useTranslations<"metaWizard">>
    readonly setConn: Dispatch<SetStateAction<MetaWizardConnection | null>>
    readonly setAgentsOf: ReturnType<typeof useSetConnectionAgents>
    readonly agentIds: ReadonlyArray<string>
}

/** The commands the Meta wizard's steps run. */
export interface MetaWizardActions {
    readonly fail: (message: string) => void
    readonly go: (to: number) => void
    readonly runCheck: (repair: boolean) => void
    readonly login: () => void
    readonly choose: () => void
    readonly saveAgents: () => void
}

/** The wizard's commands: each runs in a transition, reports a refusal as a note and moves the step on success. */
export const createMetaWizardActions = ({
    setNote,
    setIndex,
    conn,
    startChecking,
    commands,
    setCheck,
    startTransition,
    pageId,
    tm,
    setConn,
    setAgentsOf,
    agentIds,
}: MetaWizardActionsInput): MetaWizardActions => {
    const go = (to: number): void => {
        setNote(null)
        setIndex(to)
    }
    const fail = (message: string): void => setNote({ tone: "negative", text: message })

    const runCheck = (repair: boolean): void => {
        if (conn === null) return
        startChecking(async () => {
            const answer = await commands.check(conn.id, repair)
            if (answer.kind !== "ok") return fail(answer.message)
            setCheck(answer.value)
        })
    }

    const login = (): void =>
        startTransition(async () => {
            setNote(null)
            const answer = await commands.authorize(conn === null ? undefined : conn.id)
            if (answer.kind !== "ok") return fail(answer.message)
            window.location.assign(answer.value)
        })
    const choose = (): void => {
        if (conn === null || pageId === "") return setNote({ tone: "negative", text: tm("pickPick") })
        startTransition(async () => {
            const answer = await commands.choosePage(conn.id, pageId)
            if (answer.kind !== "ok") return fail(answer.message)
            setConn(answer.value)
            go(2)
        })
    }
    const saveAgents = (): void => {
        if (conn === null) return go(3)
        startTransition(async () => {
            const answer = await setAgentsOf(conn.id, agentIds)
            if (answer.kind !== "ok") return fail(answer.message)
            go(3)
            runCheck(false)
        })
    }
    return { fail, go, runCheck, login, choose, saveAgents }
}
