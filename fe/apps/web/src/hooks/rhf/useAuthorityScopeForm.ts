"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { draftsFrom } from "@/hooks/authority"
import type { StoredRule, RuleDraft } from "@/hooks/authority"

/** The values of the scope form: the mode and VND limit of every action, by rule key. */
export interface AuthorityScopeValues {
    drafts: Record<string, RuleDraft>
}

/** The scope form over the stored rules; the stored rules refill it when they change. */
export const useAuthorityScopeForm = (rules: ReadonlyArray<StoredRule>) => {
    const stored = useMemo(() => draftsFrom(rules), [rules])
    const values = useMemo<AuthorityScopeValues>(() => ({ drafts: stored }), [stored])
    return { form: useForm<AuthorityScopeValues>({ values }), stored }
}
