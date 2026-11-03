"use client"

import { useState } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import { useFeatureLifetime } from "@/hooks/reuseables"
import { useGraphQLWithToast } from "@/modules/toast"
import { submitGuarded } from "@/modules/utils"

/** Only the operation started in this active editor may hold its busy state. */
interface AccountingOperation {
    readonly identity: ReturnType<typeof useFeatureLifetime>["identity"]
    readonly isCurrent: () => boolean
}

/** The view `useAccountingSubmit` returns. */
export interface AccountingSubmitView {
    isSaving: boolean
    submit: <Values extends FieldValues>(
        form: UseFormReturn<Values>,
        save: (values: Values, isCurrent: () => boolean) => Promise<unknown>,
    ) => void
}

/** Submits an editor's form as one operation: it holds the busy state until it ends and never clears a newer operation's. */
export const useAccountingSubmit = (isActive: boolean, scope: string): AccountingSubmitView => {
    const [operation, setOperation] = useState<AccountingOperation | null>(null)
    const lifetime = useFeatureLifetime(isActive, scope)
    const runGraphQL = useGraphQLWithToast()
    return {
        isSaving: isActive && operation?.identity === lifetime.identity,
        submit: <Values extends FieldValues>(
            form: UseFormReturn<Values>,
            save: (values: Values, isCurrent: () => boolean) => Promise<unknown>,
        ) => {
            const pending = { identity: lifetime.identity, isCurrent: lifetime.capture() }
            setOperation(pending)
            submitGuarded({
                form,
                runGraphQL,
                isCurrent: pending.isCurrent,
                finish: () => setOperation((current) => (current === pending ? null : current)),
                save: (values) => save(values, pending.isCurrent),
            })
        },
    }
}
