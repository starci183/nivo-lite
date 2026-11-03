import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { toast } from "@/modules/toast"
import type { LoyaltyPanelActivation } from "./loyalty.shared"

interface PanelOperation {
    readonly scope: string
    readonly isCurrent: () => boolean
}

/** The view `useLoyaltyCommand` returns. */
export interface LoyaltyCommandView {
    isPending: boolean
    run: <T>(action: (isCurrent: () => boolean) => Promise<T>) => Promise<T | undefined>
    dispatch: (action: (isCurrent: () => boolean) => Promise<void>) => void
    /** Local completion ownership; resource authorization stays with the existing back end. */
    isCurrent: () => boolean
}

/** Owns one panel session's initiating pending state, while domain effects keep their original remote/cache owners. */
export const useLoyaltyCommand = (activation: LoyaltyPanelActivation): LoyaltyCommandView => {
    const feedback = useTranslations("toast")
    const lifetime = useFeatureLifetime(activation.isActive && activation.isReady, activation.scope)
    const running = useRef<PanelOperation | null>(null)
    const [operation, setOperation] = useState<PanelOperation | null>(null)
    const [sessionScope, setSessionScope] = useState<string | null>(null)
    const isSessionReady = activation.isActive && activation.isReady && sessionScope === activation.scope
    useFeatureReset({
        ...activation,
        onReset: () => {
            setOperation(null)
            setSessionScope(activation.isActive && activation.isReady ? activation.scope : null)
        },
    })
    const run = async <T>(action: (isCurrent: () => boolean) => Promise<T>): Promise<T | undefined> => {
        const isCurrent = lifetime.capture()
        if (!isSessionReady || !isCurrent() || running.current?.isCurrent()) return undefined
        const started = { scope: activation.scope, isCurrent }
        running.current = started
        setOperation(started)
        const settle = () => {
            if (running.current === started) running.current = null
            if (isCurrent()) setOperation((current) => (current === started ? null : current))
        }
        try {
            if (!isCurrent()) return undefined
            return await action(isCurrent)
        } finally {
            settle()
        }
    }
    const dispatch = (action: (isCurrent: () => boolean) => Promise<void>): void => {
        const isCurrent = lifetime.capture()
        run(action).catch(() => {
            if (isCurrent()) toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
        })
    }
    return {
        isPending:
            operation !== null && activation.isActive && activation.isReady && operation.scope === activation.scope,
        run,
        dispatch,
        /** Local completion ownership; resource authorization stays with the existing back end. */
        isCurrent: () => isSessionReady && lifetime.capture()(),
    }
}
