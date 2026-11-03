import type { FieldValues, UseFormReturn } from "react-hook-form"
import type { useGraphQLWithToast } from "@/modules/toast"

/** What one guarded submit needs: the form, how failures are toasted and the operation that owns the submit. */
interface GuardedSubmitInput<Values extends FieldValues> {
    readonly form: UseFormReturn<Values>
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    /** Whether the operation that started the submit is still the current one. */
    readonly isCurrent: () => boolean
    /** Ends the operation: its busy state is released. */
    readonly finish: () => void
    /** Saves the valid values. */
    readonly save: (values: Values) => Promise<unknown>
}

/** Submits a form for one operation: invalid values or a retired operation end it, and a failure is toasted before it ends. */
export const submitGuarded = <Values extends FieldValues>(input: GuardedSubmitInput<Values>): void => {
    const { form, runGraphQL, isCurrent, finish, save } = input
    const toast = (error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false })
    form.handleSubmit((values) => {
        if (!isCurrent()) return finish()
        save(values).catch(toast).finally(finish)
    }, finish)().catch((error: unknown) => toast(error).finally(finish))
}
