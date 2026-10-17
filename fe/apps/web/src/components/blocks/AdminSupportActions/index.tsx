"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { PLAN_CODES, parseCredits, parseDays, useAdminCommands } from "@/hooks/admin"
import { useQueryAdminWorkspaceSwr } from "@/hooks/swr"
import { AdminSupportActionsBase } from "./component"

/** Props for the connected support actions card. */
interface AdminSupportActionsProps {
    readonly workspaceId: string
}

/** The action waiting for a yes in the dialog. */
type Pending =
    | { readonly kind: "extend"; readonly days: number }
    | { readonly kind: "status"; readonly to: "active" | "past_due" }
    | { readonly kind: "invite"; readonly id: string; readonly email: string }
    | { readonly kind: "plan"; readonly code: string; readonly credits: number | null }

/** The connected support actions card: extend, set status, set plan and resend an invitation, each confirmed first and toasted. */
/** Connects the state and commands used by AdminSupportActions. */
const buildAdminSupportActionsState = (
    typedPlan: string | null | undefined,
    data: ReturnType<typeof useQueryAdminWorkspaceSwr>["data"],
    typedCredits: string | undefined,
    days: string,
    pending: Pending | null,
    commands: ReturnType<typeof useAdminCommands>,
    setPending: import("react").Dispatch<import("react").SetStateAction<Pending | null>>,
    t: ReturnType<typeof useTranslations<"admin">>,
    setDays: import("react").Dispatch<import("react").SetStateAction<string>>,
    setPlan: import("react").Dispatch<import("react").SetStateAction<string | null | undefined>>,
    setCredits: import("react").Dispatch<import("react").SetStateAction<string | undefined>>,
) => {
    const plan = typedPlan === undefined ? (data?.workspace.planCode ?? null) : typedPlan
    const ownLimit = data?.credits.ownLimit
    const credits = typedCredits ?? (typeof ownLimit === "number" ? String(ownLimit) : "")
    const invitations = (data?.invites ?? []).map((invite) => ({ id: invite.id, email: invite.email }))
    const parsedDays = parseDays(days)
    const parsedCredits = parseCredits(credits)
    const confirm = async () => {
        if (pending === null) return
        if (pending.kind === "extend") await commands.extend(pending.days)
        else if (pending.kind === "status") await commands.setStatus(pending.to)
        else if (pending.kind === "plan") await commands.setPlan(pending.code, pending.credits)
        else await commands.resendInvite(pending.id, pending.email)
        setPending(null)
    }
    const question = (() => {
        if (pending === null) return undefined
        if (pending.kind === "extend") return t("askExtend", { days: pending.days })
        if (pending.kind === "status") return t("askStatus", { status: pending.to })
        if (pending.kind === "invite") return t("askInvite", { email: pending.email })
        return pending.credits === null
            ? t("askPlan", { plan: pending.code })
            : t("askPlanOwn", { plan: pending.code, credits: pending.credits })
    })()
    return {
        setDays,
        setPlan,
        setCredits,
        parsedDays,
        setPending,
        plan,
        parsedCredits,
        invitations,
        confirm,
        t,
        days,
        credits,
        data,
        commands,
        question,
        pending,
    }
}

/** Draws the connected view from its current state. */
export const AdminSupportActions = (props: AdminSupportActionsProps) => {
    const t = useTranslations("admin")
    const commands = useAdminCommands(props.workspaceId)
    const { data } = useQueryAdminWorkspaceSwr({ workspaceId: props.workspaceId })
    const [days, setDays] = useState("30")
    const [typedPlan, setPlan] = useState<string | null>()
    const [typedCredits, setCredits] = useState<string>()
    const [pending, setPending] = useState<Pending | null>(null)

    const connected = buildAdminSupportActionsState(
        typedPlan,
        data,
        typedCredits,
        days,
        pending,
        commands,
        setPending,
        t,
        setDays,
        setPlan,
        setCredits,
    )
    if (connected === null) return null
    const { parsedDays, plan, parsedCredits, invitations, confirm } = connected
    return (
        <AdminSupportActionsBase
            props={adminSupportActionsProps(connected)}
            on={{
                setDays,
                setPlan,
                setCredits,
                askExtend: () => parsedDays !== undefined && setPending({ kind: "extend", days: parsedDays }),
                askActive: () => setPending({ kind: "status", to: "active" }),
                askPastDue: () => setPending({ kind: "status", to: "past_due" }),
                askPlan: () =>
                    plan !== null &&
                    parsedCredits !== undefined &&
                    setPending({ kind: "plan", code: plan, credits: parsedCredits }),
                askInvite: (id) => {
                    const invite = invitations.find((entry) => entry.id === id)
                    if (invite !== undefined) setPending({ kind: "invite", id, email: invite.email })
                },
                confirm: () => void confirm(),
                dismiss: () => setPending(null),
            }}
        />
    )
}

/** Builds the props supplied to AdminSupportActionsBase. */
const adminSupportActionsProps = (
    connected: NonNullable<ReturnType<typeof buildAdminSupportActionsState>>,
): Parameters<typeof AdminSupportActionsBase>[0]["props"] => {
    const { t, days, plan, credits, parsedDays, parsedCredits, data, invitations, commands, question, pending } =
        connected
    return {
        title: t("actionsTitle"),
        hint: t("actionsHint"),
        extendLabel: t("extendLabel"),
        extendInvalid: t("extendInvalid"),
        extendButton: t("extendButton"),
        markActiveLabel: t("markActive"),
        markPastDueLabel: t("markPastDue"),
        planLabel: t("planLabel"),
        planOptions: PLAN_CODES.map((code) => ({
            id: code,
            label: t(`plan${code.charAt(0).toUpperCase()}${code.slice(1)}`),
        })),
        creditsLabel: t("creditsLabel"),
        creditsInvalid: t("creditsInvalid"),
        setPlanLabel: t("setPlan"),
        confirmLabel: t("confirm"),
        cancelLabel: t("cancel"),
        days,
        plan,
        credits,
        isDaysValid: parsedDays !== undefined,
        isCreditsValid: parsedCredits !== undefined,
        isReady: data !== undefined,
        isActive: data?.workspace.status === "active",
        isPastDue: data?.workspace.status === "past_due",
        invites: invitations.map((invite) => ({
            ...invite,
            label: t("resendInvite", { email: invite.email }),
        })),
        isPending: commands.isPending,
        question,
        isQuestionDangerous: pending?.kind === "status" && pending.to === "past_due",
    }
}
