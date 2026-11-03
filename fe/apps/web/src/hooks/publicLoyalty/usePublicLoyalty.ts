"use client"

import { useState } from "react"
import { useMutateRequestLoyaltyCodeSwr, useMutateVerifyLoyaltyCodeSwr } from "@/hooks/swr"
import { refusalOf } from "./publicLoyalty.shared"
import type { PublicLoyaltyFailure, PublicLoyaltyPoints, PublicLoyaltyStep } from "./publicLoyalty.shared"
import type { SetStateAction, Dispatch } from "react"

type UsePublicLoyaltyResult = {
    step: PublicLoyaltyStep
    phone: string
    code: string
    failure: PublicLoyaltyFailure | null
    points: {
        name: string
        points: number
        shop: string
        tierName: string
        expiring: {
            firstAt: string | null
            points: number
        }
        nextTier: {
            missingVnd: number
            tier: {
                benefit: string
                key: string
                minSpendVnd: number
                multiplier: number
                name: string
                winbackDays: number
            }
        } | null
        rewards: Array<{
            canRedeem: boolean
            name: string
            note: string
            pointsCost: number
        }>
    } | null
    isBusy: boolean
    setPhone: Dispatch<SetStateAction<string>>
    setCode: Dispatch<SetStateAction<string>>
    sendCode: () => Promise<void>
    check: () => Promise<void>
    back: () => void
}

/** The public points check of one shop: phone, then the code sent to the customer's own chat, then the points. The anonymous calls answer refusal codes, which become `failure`. */
export const usePublicLoyalty = (slug: string): UsePublicLoyaltyResult => {
    const [step, setStep] = useState<PublicLoyaltyStep>("phone")
    const [phone, setPhone] = useState("")
    const [code, setCode] = useState("")
    const [failure, setFailure] = useState<PublicLoyaltyFailure | null>(null)
    const [points, setPoints] = useState<PublicLoyaltyPoints | null>(null)
    const request = useMutateRequestLoyaltyCodeSwr()
    const verify = useMutateVerifyLoyaltyCodeSwr()

    const sendCode = async (): Promise<void> => {
        setFailure(null)
        try {
            const answer = await request.trigger({ slug, phone })
            const refused = refusalOf(answer.code)
            if (refused === null) setStep("code")
            else setFailure(refused)
        } catch {
            setFailure("unavailable")
        }
    }

    const check = async (): Promise<void> => {
        setFailure(null)
        try {
            const answer = await verify.trigger({ slug, phone, code })
            const refused = refusalOf(answer.code)
            if (refused === null) {
                setPoints(answer.points)
                setStep("result")
            } else setFailure(refused)
        } catch {
            setFailure("unavailable")
        }
    }

    return {
        step,
        phone,
        code,
        failure,
        points,
        isBusy: request.isMutating || verify.isMutating,
        setPhone,
        setCode,
        sendCode,
        check,
        back: (): void => {
            setStep("phone")
            setCode("")
            setPoints(null)
            setFailure(null)
        },
    }
}
