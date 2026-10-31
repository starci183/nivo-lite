"use client"

import type { ReactNode } from "react"
import { useTelegramSteps } from "@/hooks/telegramConnection"
import { TelegramConnectionStepsBase } from "./component"

/** What the page hands the steps: the connection of the url and the connected body of every step but the first. */
interface TelegramConnectionStepsProps {
    readonly connectionId: string
    readonly shape: Readonly<Record<string, ReactNode>>
}

/** The connected setup steps: done or not from the page read, the first one not done opens. */
export const TelegramConnectionSteps = (props: TelegramConnectionStepsProps) => {
    const { steps, toggle } = useTelegramSteps(props.connectionId)
    return <TelegramConnectionStepsBase shape={props.shape} props={{ steps }} on={{ toggle }} />
}
