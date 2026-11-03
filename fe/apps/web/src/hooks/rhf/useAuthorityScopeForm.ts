"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { draftsFrom } from "@/modules/authority"
import type { StoredRule, RuleDraft } from "@/modules/authority"
import type { UseFormReturn } from "react-hook-form"

/** The values of the scope form: the mode and VND limit of every action, by rule key. */
export interface AuthorityScopeValues {
    drafts: Record<string, RuleDraft>
}

type UseAuthorityScopeFormResult = {
    form: UseFormReturn<AuthorityScopeValues>
    stored: Record<string, RuleDraft>
}

/** The scope form over the stored rules; the stored rules refill it when they change. */
export const useAuthorityScopeForm = (rules: ReadonlyArray<StoredRule>): UseAuthorityScopeFormResult => {
    const stored = useMemo(() => draftsFrom(rules), [rules])
    const values = useMemo<AuthorityScopeValues>(() => ({ drafts: stored }), [stored])
    return { form: useForm<AuthorityScopeValues>({ values }), stored }
}
