"use client"

import { useTranslations } from "next-intl"
import { useConnectionNeedsCopy, useInstanceHeader } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { loadingSlot, useSlotLabels } from "@/hooks/slot"
import { AgentInstanceHeaderBase } from "./component"
import type { InstanceHeaderView } from "./component"

const PLACEHOLDER: InstanceHeaderView = {
    name: "-",
    seed: "-",
    avatarUrl: null,
    isEarly: false,
    statusLabel: "-",
    statusTone: "neutral",
    subtitle: "-",
    needs: { lines: [], linkLabel: "-", href: "#" },
    chatHref: null,
    profileHref: null,
}

/** What the layout hands the header: the type and the instance of the url. */
interface AgentInstanceHeaderProps {
    readonly module: ModuleKey
    readonly installationId: string
}

/** The connected header of an agent instance: the person (avatar, name, status), "@handle - role - channels" and the chat and profile actions. */
export const AgentInstanceHeader = (props: AgentInstanceHeaderProps) => {
    const t = useTranslations("modulesCore")
    const header = useInstanceHeader(props.module, props.installationId)
    const needs = useConnectionNeedsCopy()
    const slotLabels = useSlotLabels()
    return (
        <AgentInstanceHeaderBase
            props={{
                earlyLabel: t("earlyBadge"),
                chatLabel: t("privateChat"),
                profileLabel: t("profileShort"),
                slot: header.isLoading
                    ? loadingSlot()
                    : {
                          items: {
                              name: header.name,
                              seed: header.seed,
                              avatarUrl: header.avatarUrl,
                              isEarly: header.isEarly,
                              statusLabel: t(`lifecycle_${header.lifecycle}`),
                              statusTone: header.statusTone,
                              subtitle: header.subtitle,
                              needs: {
                                  lines: needs.linesOf(header.connectionNeeds),
                                  linkLabel: needs.linkLabel,
                                  href: needs.href,
                              },
                              chatHref: header.chatHref,
                              profileHref: header.profileHref,
                          },
                      },
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("loadFailed")),
            }}
        />
    )
}
