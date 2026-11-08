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
    const [isAsking, setIsAsking] = useState(false)
    const [isRotating, setIsRotating] = useState(false)
    return {
        isAsking,
        isRotating,
        ask: (): void => setIsAsking(true),
        dismiss: (): void => setIsAsking(false),
        confirm: (): void => {
            setIsRotating(true)
            void rotateKey().then(() => {
                setIsRotating(false)
                setIsAsking(false)
            })
        },
    }
}
