"use client"

import type { AccountingWorkbenchData } from "@/modules/types"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { agentHref } from "@/modules/installations"
import { moneyOf } from "@/modules/utils"
import { useAccountingQuestions } from "./useAccountingQuestions"

/** How many of the waiting questions the card shows: the oldest ones. */
const WAITING_ROWS = 3
/** The shortest written basis a confirmed unclear payment needs. */
const BASIS_MIN_CHARS = 10

/** The view `useAccountingWaiting` returns. */
export interface AccountingWaitingView {
    props: {
        title: string
        count: string | null
        rows: {
            id: string
            title: string
            summary: string
            reason: string
            status: string
            tone: "success" | "danger" | "warning"
            amount: string | null
            canAct: boolean
            isOpen: boolean
            isBusy: boolean
            isApproveDisabled: boolean
            basis: {
                value: string
                label: string
                hint: string
            } | null
            approveLabel: string
            rejectLabel: string
            waitingLabel: string
            error: string | null
        }[]
        more: string | null
        moreLabel: string
        moreHref: string
        moreMenuLabel: string
        emptyMessage: string
        emptyBody: string
    }
    on: {
        approve: (id: string) => void
        reject: (id: string) => void
        changeBasis: (id: string, value: string) => void
    }
}

/**
 * The "waiting for you" card of the Accounting workbench: the oldest waiting questions, each decided in place. Approve stays off
 * until the basis a question asks for is written; a member who may not decide sees the proposal and who is waited for, no buttons.
 */
export const useAccountingWaiting = (
    data: AccountingWorkbenchData,
    isActive: boolean,
    scope: string,
): AccountingWaitingView => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const oldest = useMemo(
        () =>
            [...data.questions]
                .sort((a, b) => a.item.created_at.localeCompare(b.item.created_at))
                .slice(0, WAITING_ROWS),
        [data.questions],
    )
    const questions = useAccountingQuestions(oldest, data.ownerName, isActive, scope)
    const cards = questions.props.groups.flatMap((group) => group.items)
    const rows = oldest.flatMap((question) => {
        const card = cards.find((candidate) => candidate.id === question.item.id)
        if (card === undefined) return []
        const amount = question.item.proposal.amount_vnd
        return [
            {
                id: card.id,
                title: card.title,
                summary: card.summary,
                reason: t("waitingReason"),
                status: card.status,
                tone: card.statusTone,
                amount: amount == null ? null : moneyOf(format, amount),
                canAct: card.canAct && card.isOpen,
                isOpen: card.isOpen,
                isBusy: card.isBusy,
                isApproveDisabled: card.basis !== null && card.basis.trim().length < BASIS_MIN_CHARS,
                basis:
                    card.basis === null
                        ? null
                        : {
                              value: card.basis,
                              label: card.basisLabel,
                              hint: card.basisHint,
                          },
                approveLabel: card.approveLabel,
                rejectLabel: card.rejectLabel,
                waitingLabel: card.waitingLabel,
                error: card.error,
            },
        ]
    })
    const rest = data.questions.length - rows.length
    return {
        props: {
            title: t("waitingTitle"),
            count: data.questions.length > 0 ? String(data.questions.length) : null,
            rows,
            more: rest > 0 ? t("waitingMore", { n: rest }) : null,
            moreLabel: t("openQuestions"),
            moreHref: agentHref("accounting", null, "workbench", "tab=questions"),
            moreMenuLabel: t("waitingMenu"),
            emptyMessage: t("questionsEmpty"),
            emptyBody: t("questionsEmptyBody"),
        },
        on: {
            approve: questions.on.approve,
            reject: questions.on.reject,
            changeBasis: questions.on.changeBasis,
        },
    }
}
