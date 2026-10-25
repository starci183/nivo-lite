import { exceptionCardAnchor } from "./office.message-view"
import { leadHref } from "@/modules/routes"
import type { OfficeExceptionView, OfficeMissingField } from "@/modules/types"
import { fieldTextOf, isOpenWork } from "./office.helpers"
import type { OfficeWork } from "./office.types"
import { NIVO_AVATAR, agentAvatarOf, departmentAgentOf, leadNameOf } from "./office.words"
import type { OfficeContext, OfficeWords } from "./office.words"

const BASIS_FIELDS: ReadonlySet<string> = new Set([
    "contact_name",
    "need",
    "contact",
    "customer",
    "items",
    "amount_vnd",
])

const missingFieldOf = (name: string, words: OfficeWords): OfficeMissingField => ({
    name,
    label: BASIS_FIELDS.has(name) ? words.g(`field_${name}`) : name,
})

const workBadgeOf = (work: OfficeWork, isReconcile: boolean, words: OfficeWords): string => {
    const isFailed = work.status === "failed"
    if (isReconcile && !isFailed) return words.t("reconcileWaiting")
    if (work.reason !== null) return words.g(`reason_${work.reason}`)
    return isFailed ? words.g("status_failed") : words.t("exceptionTitle")
}

const workStatusOf = (work: OfficeWork): OfficeExceptionView["status"] => {
    if (isOpenWork(work)) return work.status === "failed" ? "failed" : "open"
    return work.status === "rejected" ? "rejected" : "done"
}

const workFooterOf = (work: OfficeWork, words: OfficeWords, context: OfficeContext): string | null => {
    const staff = context.staff.find((member) => member.id === work.assignedStaffId)
    const stamp = words.stamp(work.completedAt ?? work.updatedAt)
    if (staff !== undefined) return words.t("exceptionAssigned", { name: staff.name, time: stamp })
    if (isOpenWork(work)) return null
    const status = words.g(work.status === "rejected" ? "status_rejected" : "status_done")
    return words.t("exceptionDecided", { status, who: words.t("teammate"), time: stamp })
}

const heldLineOf = (work: OfficeWork, words: OfficeWords): string | null => {
    const note = fieldTextOf(work.fields, "hold_note")
    if (note === "" || !isOpenWork(work)) return null
    const who = fieldTextOf(work.fields, "hold_by")
    const at = fieldTextOf(work.fields, "hold_at")
    return words.t("heldLine", {
        note,
        who: who === "" ? words.t("teammate") : who,
        time: words.stamp(at === "" ? work.updatedAt : at),
    })
}

const creditLineOf = (work: OfficeWork, words: OfficeWords): string => {
    const payer = fieldTextOf(work.fields, "payer")
    const reference = fieldTextOf(work.fields, "reference")
    return words.t("reconcileCreditLine", {
        amount: work.amountVnd === null ? "-" : words.money(work.amountVnd),
        payer: payer === "" ? words.t("reconcileUnknown") : payer,
        ref: reference === "" ? words.t("reconcileUnknown") : reference,
    })
}

const candidateChoicesOf = (work: OfficeWork, words: OfficeWords): OfficeExceptionView["choices"] =>
    work.candidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        description: candidate.label.includes(words.money(candidate.amountVnd))
            ? null
            : words.money(candidate.amountVnd),
    }))

const workTitleOf = (work: OfficeWork, words: OfficeWords, leadName: string | null): string => {
    const action = words.g(`action_${work.action}`)
    return leadName === null ? action : [action, leadName].join(" · ")
}

/** Which state an exception is in. */
type ExceptionFlags = { readonly isOpen: boolean; readonly isFailed: boolean; readonly isReconcile: boolean }

const reasonViewOf = (
    work: OfficeWork,
    words: OfficeWords,
    flags: ExceptionFlags,
): Pick<OfficeExceptionView, "hint" | "reasonBadge"> => {
    if (work.reason === null || !flags.isOpen || flags.isFailed) return { hint: null, reasonBadge: null }
    return {
        hint: words.g(`reasonHint_${work.reason}`),
        reasonBadge: flags.isReconcile ? words.g(`reason_${work.reason}`) : null,
    }
}

/** An exception with its words, its choices and who may decide it. */
export const exceptionView = (work: OfficeWork, words: OfficeWords, context: OfficeContext): OfficeExceptionView => {
    const isOpen = isOpenWork(work)
    const isFailed = work.status === "failed"
    const isReconcile = work.action === "reconcile_payment"
    const agent = departmentAgentOf(context, work.department)
    const leadName = leadNameOf(context, work.leadId)
    const missing = isFailed ? [] : work.missingFields
    const basis = fieldTextOf(work.fields, "basis")
    const title = workTitleOf(work, words, leadName)
    const reason = reasonViewOf(work, words, { isOpen, isFailed, isReconcile })
    return {
        kind: "exception",
        key: `exception-${work.id}`,
        id: work.id,
        anchor: exceptionCardAnchor(work.id),
        author: agent === null ? words.t("nivoCore") : agent.name,
        avatar: agent === null ? NIVO_AVATAR : agentAvatarOf(agent),
        isAi: agent !== null,
        time: words.time(work.createdAt),
        title,
        hint: reason.hint,
        status: workStatusOf(work),
        badge: isOpen ? workBadgeOf(work, isReconcile, words) : words.g(`status_${work.status}`),
        department: words.g(`dept_${work.department}`),
        reasonBadge: reason.reasonBadge,
        isReconcile,
        errorText: isFailed ? work.error : null,
        summary: work.summary,
        draft: work.draft === null || work.draft === "" ? null : work.draft,
        amount: missing.includes("amount_vnd") ? null : work.amountVnd,
        missing: missing.map((name) => missingFieldOf(name, words)),
        choices: candidateChoicesOf(work, words),
        creditLine: isOpen && !isFailed && isReconcile ? creditLineOf(work, words) : null,
        result: isOpen ? null : work.resultSummary,
        decidedBasis: basis === "" || isOpen ? null : words.t("decidedBasis", { basis }),
        heldLine: heldLineOf(work, words),
        footer: workFooterOf(work, words, context),
        leadHref: work.leadId === null ? null : leadHref(work.leadId),
        canAct: context.canDecide(work.assignedStaffId),
        isFocused: context.focusedId === work.id,
    }
}
