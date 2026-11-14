"use client"

import { Alert } from "@starci/grammar/common"
import { useLocale, useTranslations } from "next-intl"
import { useSetupState } from "@/hooks/agentSetup"
import { useInstallations } from "@/hooks/installations"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import type { ModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { gateEntry, gateLabel, isSetupPending } from "@/modules/installations"

/** The agent whose notice this is, and the setup page its one action opens. */
interface AgentSetupPendingNoticeProps {
    readonly module: ModuleKey
    readonly installationId: string
    readonly setupHref: string
}

/**
 * The one neutral notice of an agent whose setup is not applied ("needs_setup" / "setting_up"): it does not answer customers yet.
 * Says how far setup is (`setupProgress` of the installation) and which gates are left (the module's gates minus the confirmed ones of
 * the setup session), with the "finish setup" action opening the setup page. Draws nothing for any other lifecycle.
 */
export const AgentSetupPendingNotice = (props: AgentSetupPendingNoticeProps) => {
    const t = useTranslations("modulesCore")
    const locale = useLocale() === "en" ? "en" : "vi"
    const router = navigation.useRouter()
    const installation = useInstallations().installations?.find((entry) => entry.id === props.installationId)
    const state = useSetupState(props.installationId)
    const gates = useModuleCatalog().modules[props.module]?.gates ?? []
    if (installation === undefined || !isSetupPending(installation.lifecycle)) return null
    const session = "items" in state.slot ? state.slot.items.session : undefined
    const left =
        session === undefined
            ? []
            : gates
                  .filter((gate) => gateEntry(session.gateEvidence, gate.key).status !== "confirmed")
                  .map((gate) => gateLabel(gate, locale))
    const { confirmed, total } = installation.setupProgress
    return (
        <Alert
            tone="neutral"
            title={t("setupPendingTitle")}
            description={[
                t("setupPendingProgress", { confirmed, total }),
                left.length === 0 ? "" : t("setupPendingLeft", { list: left.join(", ") }),
            ]
                .filter((part) => part !== "")
                .join(" ")}
            action={{ label: t("setupPendingAction"), onAction: () => router.push(props.setupHref) }}
        />
    )
}
