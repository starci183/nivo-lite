"use client"

import { useFormatter, useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import type { Connection, RowView } from "@/modules/types"

/** One labelled fact of the details card of a connection without a page of its own. */
export interface ConnectionOpenFact {
    readonly id: string
    readonly label: string
    readonly value: string
}

/** The latest event the connection reported, worded. */
export interface ConnectionOpenEvent {
    readonly title: string
    readonly description: string
}

/** The details card rows and the latest event of a connection. */
interface ConnectionOpenFactsRead {
    readonly facts: ReadonlyArray<ConnectionOpenFact>
    readonly event: ConnectionOpenEvent | null
}

/** A row of the card that exists only when its value does. */
const optional = (id: string, label: string, value: string): ReadonlyArray<ConnectionOpenFact> =>
    value === "" ? [] : [{ id, label, value }]

/**
 * The details of a connection that has no page of its own, from the connection and the view of its row: its type and name, what
 * identifies it, its environment, who uses it and when it last reported an event. Nothing while the connection is read.
 */
export const useConnectionOpenFacts = (connection: Connection | undefined, view: RowView): ConnectionOpenFactsRead => {
    const t = useTranslations("connections")
    const format = useFormatter()
    if (connection === undefined) return { facts: [], event: null }
    const last =
        connection.lastEventAt === null
            ? ""
            : format.dateTime(new Date(connection.lastEventAt), { dateStyle: "short", timeStyle: "short" })
    return {
        facts: [
            { id: "provider", label: t("openFactProvider"), value: t(providerKey(connection.provider, "title")) },
            { id: "name", label: t("openFactName"), value: connection.name },
            ...optional("detail", t("openFactDetail"), view.facts),
            ...optional("env", t("openFactEnv"), view.envLabel ?? ""),
            ...optional("usedBy", t("openFactUsedBy"), view.usedBy),
            ...optional("lastEvent", t("openFactLastEvent"), last),
        ],
        event: last === "" ? null : { title: t("openEventLatest"), description: last },
    }
}
