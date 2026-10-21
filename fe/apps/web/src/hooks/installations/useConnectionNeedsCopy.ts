"use client"

import { useTranslations } from "next-intl"
import type { InstallationConnectionNeed } from "@/modules/installations"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** The words of what a `needs_connection` agent waits for, and where it is connected. */
export interface ConnectionNeedsCopy {
    /** One line per missing role: "Needs a connection: A or B" with the providers the back end names (data, never fixed). */
    readonly linesOf: (needs: ReadonlyArray<InstallationConnectionNeed>) => ReadonlyArray<string>
    readonly linkLabel: string
    readonly href: string
}

/** The connection needs of an agent in the reader language, with the link to Settings, Connections. */
export const useConnectionNeedsCopy = (): ConnectionNeedsCopy => {
    const t = useTranslations("modulesCore")
    return {
        linesOf: (needs) =>
            needs.map((need) =>
                need.providers.length === 0
                    ? t("needsRole", { role: need.role })
                    : t("needsConnection", { providers: need.providers.join(t("providersOr")) }),
            ),
        linkLabel: t("openConnections"),
        href: CONSOLE_ROUTES.connections,
    }
}
