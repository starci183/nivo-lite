"use client"

import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { AutomationsBoard } from "@/features/automations/AutomationsBoard"
import type { AutomationsData } from "@/features/automations/useAutomations"
import { refreshAutomations } from "@/lib/automation-actions"
import type { ModuleScope } from "@/lib/automation-shared"
import { AgentAutomationsCardBase } from "./component"

/** The module whose automations the card lists. */
type AgentAutomationsCardProps = {
    readonly moduleKey: ModuleScope
    readonly href: string
}

/** The connected automations card of a module: loads its own data, so the settings page stays as it is. Owners and managers only (the page leaves it out otherwise). */
export const AgentAutomationsCard = (props: AgentAutomationsCardProps) => {
    const t = useTranslations("modulesCore")
    const [data, setData] = useState<AutomationsData | null>(null)
    const [isFailed, setFailed] = useState(false)
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        let live = true
        void refreshAutomations().then((result) => {
            if (!live) return
            if (result.ok) {
                setData(result.data)
                setFailed(false)
            } else {
                setFailed(true)
            }
        })
        return () => {
            live = false
        }
    }, [attempt])
    return (
        <AgentAutomationsCardBase
            props={{
                title: t("autoTitle"),
                seeAllLabel: t("autoSeeAll"),
                seeAllHref: props.href,
                help: t("autoHelp"),
                loadingText: t("autoLoading"),
                failureTitle: t("autoLoadFailed"),
                retryLabel: t("autoRetry"),
                isFailed,
                isLoaded: data !== null,
            }}
            on={{
                retry: () => {
                    setFailed(false)
                    setAttempt((count) => count + 1)
                },
            }}
        >
            {data === null ? null : <AutomationsBoard initial={data} layout="module" moduleKey={props.moduleKey} />}
        </AgentAutomationsCardBase>
    )
}
