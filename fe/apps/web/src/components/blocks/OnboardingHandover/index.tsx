"use client"

import { useTranslations } from "next-intl"
import { useOnboardingHandover } from "@/hooks/onboardingHandover"
import { APP_ROUTES } from "@/modules/routes"
import { OnboardingHandoverBase } from "./component"

/** Who holds new customers as the row reads: "…" while unread, "You" for the signed-in owner, else the owner's name. */
const ownerLabel = (owner: { readonly name: string; readonly isMe: boolean } | undefined, you: string): string => {
    if (owner === undefined) return "…"
    return owner.isMe ? you : owner.name
}

/** The connected handover step: who holds new customers (the workspace owner) and whether the AI asks before it sends (the `reply_customer` rule), both read live; the approval can be switched here. */
export const OnboardingHandover = () => {
    const t = useTranslations("onboarding")
    const handover = useOnboardingHandover()
    const ownerValue = ownerLabel(handover.owner, t("ruleOwnerValue"))
    const approvalValue = {
        ask: t("ruleApprovalValue"),
        auto: t("ruleApprovalOff"),
        never: t("ruleApprovalNever"),
        unknown: "…",
    }[handover.approval]
    return (
        <OnboardingHandoverBase
            props={{
                title: t("handoverTitle"),
                heading: t("handoverQuestion"),
                description: t("handoverText"),
                rules: [
                    { id: "owner", name: t("ruleOwner"), description: t("ruleOwnerText"), value: ownerValue },
                    {
                        id: "approval",
                        name: t("ruleApproval"),
                        description: t("ruleApprovalText"),
                        value: approvalValue,
                        toggle: {
                            isOn: handover.approval === "ask",
                            isDisabled: handover.isLocked || handover.isSaving,
                        },
                    },
                ],
                backLabel: t("back"),
                backHref: APP_ROUTES.workspaceChannels,
                finishLabel: t("finish"),
                finishHref: APP_ROUTES.workspaceReady,
            }}
            on={{ toggle: (_ruleId, on) => handover.setApproval(on) }}
        />
    )
}
