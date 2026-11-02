import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useFeatureLifetime } from "@/hooks/reuseables"
import { toast } from "@/modules/toast"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
/** An initiating card owns pending through remote feedback and cache settlement. */
export const useShiftsOperation = (input: ShiftsPanelInput) => {
    const lifetime = useFeatureLifetime(input.isActive, input.scope)
    const feedback = useTranslations("toast")
    const running = useRef(new Map<string, { readonly identity: typeof lifetime.identity; readonly token: symbol }>())
    const [pending, setPending] = useState<
        ReadonlyArray<{ readonly identity: typeof lifetime.identity; readonly tag: string; readonly token: symbol }>
    >([])
    const run = async <T>(tag: string, action: () => Promise<T>): Promise<T | undefined> => {
        const isCurrent = lifetime.capture()
        if (!isCurrent() || running.current.get(tag)?.identity === lifetime.identity) return undefined
        const token = Symbol(tag)
        running.current.set(tag, { identity: lifetime.identity, token })
        setPending((current) => [...current, { identity: lifetime.identity, tag, token }])
        try {
            const result = await action()
            return isCurrent() ? result : undefined
        } finally {
            if (running.current.get(tag)?.token === token) running.current.delete(tag)
            setPending((current) => current.filter((item) => item.token !== token))
        }
    }
    const observe = (action: Promise<unknown>): void => {
        const isCurrent = lifetime.capture()
        action.catch(() => {
            if (isCurrent()) toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
        })
    }
    return {
        run,
        observe,
        capture: lifetime.capture,
        isPending: (tag: string) => pending.some((item) => item.identity === lifetime.identity && item.tag === tag),
        tag: pending.find((item) => item.identity === lifetime.identity)?.tag ?? null,
    }
}
