"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { draftsFrom } from "@/modules/authority"
import type { StoredRule, RuleDraft } from "@/modules/authority"

/** The values of the limits form: the note and the required details of every action, by rule key. */
export interface AuthorityLimitsValues {
    limitsNote: string
    drafts: Record<string, RuleDraft>
}

/** The limits form over the stored note and rules; the stored values refill it when they change. */
export const useAuthorityLimitsForm = (limitsNote: string, rules: ReadonlyArray<StoredRule>) => {
    const stored = useMemo(() => draftsFrom(rules), [rules])
    const values = useMemo<AuthorityLimitsValues>(() => ({ limitsNote, drafts: stored }), [limitsNote, stored])
    return { form: useForm<AuthorityLimitsValues>({ values }), stored }
}
