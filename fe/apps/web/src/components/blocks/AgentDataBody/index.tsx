"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { SpecWorkbenchFrame } from "@/components/blocks/SpecWorkbenchFrame"
import type { ModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"
import { dataViewOf, workbenchSpec } from "@/modules/workbench-spec"
import { ReadFreshnessContext, type ReadFreshness } from "@/modules/workbench-host"
import { AgentDataBodyBase } from "./component"

/** What the route hands the data page: the workspace, the type and the instance of the url, and the key of the set. */
interface AgentDataBodyProps {
    readonly workspaceId: string
    readonly module: ModuleKey
    readonly installationId: string
    readonly set: string
}

/** The freshness the page shows out of the answers its reads gave: the oldest synced one when any is synced, else live; null while none states it. */
const oldestOf = (known: ReadonlyArray<ReadFreshness>): ReadFreshness | null => {
    const synced = known.filter((entry) => entry.source === "synced")
    const first = synced[0]
    if (first === undefined) return known[0] ?? null
    return synced.reduce((oldest, entry) => ((entry.asOf ?? "") < (oldest.asOf ?? "") ? entry : oldest), first)
}

/**
 * The data page of an agent: one view of the module's spec (`data-<set>`) on a page of its own, beside the desk and not a tab of it. The
 * spec decides what is drawn (a table with paging and the detail of the chosen row); this adds the way back to the desk and says how
 * fresh the provider data is. A set the module's spec does not hold shows the not-found state with the way back, never an empty page.
 */
export const AgentDataBody = (props: AgentDataBodyProps) => {
    const t = useTranslations("agentData")
    const format = useFormatter()
    const [known, setKnown] = useState<Readonly<Record<string, ReadFreshness>>>({})
    const report = useCallback((operation: string, freshness: ReadFreshness | null): void => {
        setKnown((current) => {
            const rest = Object.entries(current).filter(([name]) => name !== operation)
            return Object.fromEntries(freshness === null ? rest : [...rest, [operation, freshness]])
        })
    }, [])
    const resolved = workbenchSpec(props.module)
    const view = useMemo(() => (resolved === null ? null : dataViewOf(resolved.spec, props.set)), [resolved, props.set])
    const backHref = workspaceHref(props.workspaceId, agentHref(props.module, props.installationId, "workbench"))
    const freshness = oldestOf(Object.values(known))
    const note = useMemo(() => {
        if (freshness === null) return null
        if (freshness.source === "live") return t("freshLive")
        if (freshness.asOf === null) return t("freshSyncedUnknown")
        return t("freshSynced", { asOf: format.dateTime(new Date(freshness.asOf), { dateStyle: "medium", timeStyle: "short" }) })
    }, [freshness, format, t])
    return (
        <ReadFreshnessContext.Provider value={report}>
            <AgentDataBodyBase
                props={{
                    backLabel: t("back"),
                    backHref,
                    freshness: note,
                    unknown: view === null ? { title: t("unknownTitle"), body: t("unknownBody") } : null,
                }}
            >
                {view === null ? null : (
                    <SpecWorkbenchFrame
                        module={props.module}
                        installationId={props.installationId}
                        spec={view.spec}
                        fallback={null}
                        tab={view.id}
                        isBare
                    />
                )}
            </AgentDataBodyBase>
        </ReadFreshnessContext.Provider>
    )
}
