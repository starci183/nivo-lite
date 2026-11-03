"use client"

import { useState } from "react"
import type { Settled } from "@/hooks/connection-wizard"

type UseSepayRotateResult = {
    isAsking: boolean
    isRotating: boolean
    ask: () => void
    dismiss: () => void
    confirm: () => void
}

/** The new-key flow of the Setup tab: the confirmation that is open or not, and the command that runs once it is confirmed. */
export const useSepayRotate = (rotateKey: () => Promise<Settled<true>>): UseSepayRotateResult => {
    const [isAsking, setAsking] = useState(false)
    const [isRotating, setRotating] = useState(false)
    return {
        isAsking,
        isRotating,
        ask: (): void => setAsking(true),
        dismiss: (): void => setAsking(false),
        confirm: (): void => {
            setRotating(true)
            void rotateKey().then(() => {
                setRotating(false)
                setAsking(false)
            })
        },
    }
}
