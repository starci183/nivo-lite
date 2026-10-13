import type { Metadata } from "next"
import { getFormatter, getTranslations } from "next-intl/server"
import { readAccount } from "@/modules/db"
import { AccountPageBase } from "./component"

/** Sign-in methods the page lists, in order. */
const METHOD_IDS = ["google", "email"] as const

/** The document title of the page. */
export const accountMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("account")
    return { title: t("title") }
}

/** The /account screen body: reads the account, its sign-in methods and its device sessions. */
export const AccountPage = async () => {
    const t = await getTranslations("account")
    const format = await getFormatter()
    const account = await readAccount()
    if (account.kind !== "ok") throw new Error(`account: ${account.kind} ${account.code}`)
    const now = new Date()
    const when = (iso: string | null): string => {
        if (iso === null) return "-"
        const at = new Date(iso)
        return now.getTime() - at.getTime() < 60_000 ? t("justNow") : format.relativeTime(at, now)
    }
    return (
        <AccountPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbHome: t("crumbHome"),
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
                methodsTitle: t("methodsTitle"),
                linkedLabel: t("methodLinked"),
                notLinkedLabel: t("methodNotLinked"),
                name: account.value.name,
                email: account.value.email,
                methods: METHOD_IDS.map((id) => ({
                    id,
                    label: id === "google" ? t("methodGoogle") : t("methodEmail"),
                    isLinked: account.value.providers.includes(id),
                })),
                sessions: account.value.sessions.map((session) => ({
                    id: session.id,
                    device:
                        session.device.browser !== null && session.device.os !== null
                            ? t("deviceOn", { browser: session.device.browser, os: session.device.os })
                            : (session.device.browser ?? session.device.os ?? t("deviceUnknown")),
                    facts: [
                        session.ip === null ? null : `${t("ipLabel")} ${session.ip}`,
                        t("created", { when: when(session.createdAt) }),
                        t("lastActive", { when: when(session.lastActiveAt) }),
                    ]
                        .filter((part) => part !== null)
                        .join(" · "),
                    isCurrent: session.isCurrent,
                })),
                sessionsFailed: account.value.sessionsFailed,
                isLoading: false,
            }}
        />
    )
}

/** The same page while its data loads: labels and anatomy stay, values and device rows are skeletons. */
export const AccountLoadingPage = async () => {
    const t = await getTranslations("account")
    return (
        <AccountPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbHome: t("crumbHome"),
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
                methodsTitle: t("methodsTitle"),
                linkedLabel: t("methodLinked"),
                notLinkedLabel: t("methodNotLinked"),
                name: "",
                email: "",
                methods: METHOD_IDS.map((id) => ({
                    id,
                    label: id === "google" ? t("methodGoogle") : t("methodEmail"),
                    isLinked: false,
                })),
                sessions: [],
                sessionsFailed: false,
                isLoading: true,
            }}
        />
    )
}
