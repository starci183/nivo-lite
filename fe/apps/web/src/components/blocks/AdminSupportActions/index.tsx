"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { PLAN_CODES, parseCredits, parseDays, useAdminCommands } from "@/hooks/admin"
import type { AdminInviteRef, AdminReply } from "@/hooks/admin"
import { navigation } from "@/modules/i18n"
import { AdminSupportActionsBase } from "./component"

/** Props for the connected support actions card. */
interface AdminSupportActionsProps {
    readonly workspaceId: string
    /** The billing status now on the workspace. */
    readonly status: string
    readonly planCode: string | null
    /** The workspace's own monthly credit allowance; null when the plan's applies. */
    readonly creditsLimit: number | null
    readonly invites: ReadonlyArray<AdminInviteRef>
}

/** The action waiting for a yes in the dialog. */
type Pending =
    | { readonly kind: "extend"; readonly days: number }
    | { readonly kind: "status"; readonly to: "active" | "past_due" }
    | { readonly kind: "invite"; readonly id: string; readonly email: string }
    | { readonly kind: "plan"; readonly code: string; readonly credits: number | null }

/** The connected support actions card: extend, set status, set plan and resend an invitation, each confirmed first. */
export const AdminSupportActions = (props: AdminSupportActionsProps) => {
    const t = useTranslations("admin")
    const router = navigation.useRouter()
    const commands = useAdminCommands(props.workspaceId)
    const [isPending, startTransition] = useTransition()
    const [days, setDays] = useState("30")
    const [plan, setPlan] = useState<string | null>(props.planCode)
    const [credits, setCredits] = useState(props.creditsLimit === null ? "" : String(props.creditsLimit))
    const [pending, setPending] = useState<Pending | null>(null)
    const [error, setError] = useState<string>()
    const [done, setDone] = useState<string>()

    const parsedDays = parseDays(days)
    const parsedCredits = parseCredits(credits)

    const ask = (next: Pending) => {
        setError(undefined)
        setDone(undefined)
        setPending(next)
    }
    const finish = (reply: AdminReply, message: string) => {
        setPending(null)
        if (reply.kind === "ok") {
            setDone(message)
            router.refresh()
            return
        }
        setError(reply.message ?? t("failText"))
    }
    const confirm = () => {
        if (pending === null) return
        startTransition(async () => {
            if (pending.kind === "extend") {
                finish(await commands.extend(pending.days), t("doneExtend", { days: pending.days }))
            } else if (pending.kind === "status") {
                finish(await commands.setStatus(pending.to), t("doneStatus", { status: pending.to }))
            } else if (pending.kind === "plan") {
                const message =
                    pending.credits === null
                        ? t("donePlan", { plan: pending.code })
                        : t("donePlanOwn", { plan: pending.code, credits: pending.credits })
                finish(await commands.setPlan(pending.code, pending.credits), message)
            } else {
                const reply = await commands.resendInvite(pending.id)
                const isUndelivered = reply.kind === "ok" && reply.isUndelivered
                finish(reply, t(isUndelivered ? "doneResendNone" : "doneResend", { email: pending.email }))
            }
        })
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

    return (
        <AdminSupportActionsBase
            props={{
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
                failTitle: t("failTitle"),
                days,
                plan,
                credits,
                isDaysValid: parsedDays !== undefined,
                isCreditsValid: parsedCredits !== undefined,
                isActive: props.status === "active",
                isPastDue: props.status === "past_due",
                invites: props.invites.map((invite) => ({
                    ...invite,
                    label: t("resendInvite", { email: invite.email }),
                })),
                isPending,
                question,
                isQuestionDangerous: pending?.kind === "status" && pending.to === "past_due",
                error,
                done,
            }}
            on={{
                setDays,
                setPlan,
                setCredits,
                askExtend: () => parsedDays !== undefined && ask({ kind: "extend", days: parsedDays }),
                askActive: () => ask({ kind: "status", to: "active" }),
                askPastDue: () => ask({ kind: "status", to: "past_due" }),
                askPlan: () =>
                    plan !== null &&
                    parsedCredits !== undefined &&
                    ask({ kind: "plan", code: plan, credits: parsedCredits }),
                askInvite: (id) => {
                    const invite = props.invites.find((entry) => entry.id === id)
                    if (invite !== undefined) ask({ kind: "invite", id, email: invite.email })
                },
                confirm,
                dismiss: () => setPending(null),
            }}
        />
    )
}
