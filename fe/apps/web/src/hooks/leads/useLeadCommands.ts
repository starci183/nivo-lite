import { useLocale } from "next-intl"
import { useCallback, useMemo } from "react"
import { decodeRecordedOutcome, decodeResponsibility, request } from "@/modules/api"
import type { Outcome, RecordedOutcomeItem, ResponsibilityItem } from "@/modules/api"
import { readBrowserAccessToken } from "@/modules/db/browser"
import type { LeadStageId } from "@/modules/types"

/** What a person types to add or change the step of a lead. */
export interface StepInput {
    /** `human` for the signed-in person, else the id of an agent. */
    readonly owner: string
    readonly nextAction: string
    /** ISO 8601, or null for no date. */
    readonly dueAt: string | null
}

/** The calls the lead screens make to the back end api. */
export interface LeadCommands {
    readonly recordOutcome: (
        leadId: string,
        stage: LeadStageId,
        evidence: string,
    ) => Promise<Outcome<RecordedOutcomeItem>>
    readonly addResponsibility: (
        leadId: string,
        title: string,
        input: StepInput,
    ) => Promise<Outcome<ResponsibilityItem>>
    readonly assignResponsibility: (
        responsibilityId: string,
        input: StepInput,
        title: string | null,
    ) => Promise<Outcome<ResponsibilityItem>>
}

const unauthenticated = (code: string): Outcome<never> => ({ kind: "refused", status: 401, fault: { code } })

/** The lead commands of one workspace, sent with the signed-in person token and the reader language; the back end proves the membership. */
export const useLeadCommands = (workspaceId: string): LeadCommands => {
    const locale = useLocale()
    const send = useCallback(
        async <T>(
            path: string,
            method: "POST" | "PATCH",
            body: unknown,
            decode: (text: string) => Outcome<T>,
        ): Promise<Outcome<T>> => {
            const token = await readBrowserAccessToken()
            if (token.kind !== "ok") return unauthenticated(token.code)
            return request({ path, method, token: token.value, locale, workspaceId, body }, decode)
        },
        [locale, workspaceId],
    )
    return useMemo<LeadCommands>(
        () => ({
            recordOutcome: (leadId, stage, evidence) =>
                send(`/leads/${leadId}/outcome`, "POST", { stage, evidence }, decodeRecordedOutcome),
            addResponsibility: (leadId, title, input) =>
                send(`/leads/${leadId}/responsibilities`, "POST", { title, ...input }, decodeResponsibility),
            assignResponsibility: (responsibilityId, input, title) =>
                send(`/responsibilities/${responsibilityId}`, "PATCH", { ...input, title }, decodeResponsibility),
        }),
        [send],
    )
}
