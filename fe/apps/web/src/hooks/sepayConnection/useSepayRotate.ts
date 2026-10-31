"use client"

import { useState } from "react"
import type { Settled } from "@/hooks/connection-wizard"

/** The new-key flow of the Setup tab: the confirmation that is open or not, and the command that runs once it is confirmed. */
export const useSepayRotate = (rotateKey: () => Promise<Settled<true>>) => {
    const [isAsking, setAsking] = useState(false)
    const [isRotating, setRotating] = useState(false)
    return {
        isAsking,
        isRotating,
        ask: () => setAsking(true),
        dismiss: () => setAsking(false),
        confirm: () => {
            setRotating(true)
            void rotateKey().then(() => {
                setRotating(false)
                setAsking(false)
            })
        },
    }
}
