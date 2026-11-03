"use client"

import { setupStepViewOf } from "@/hooks/connectionPage"
import type { ZaloStepId } from "@/modules/types"
import { useZaloSetupSteps } from "./useZaloSetupSteps"

type UseZaloSetupStepResult = {
    step: {
        ordinal: number
        title: string
        summary: string
        hint: string
        isOpen: boolean
    }
    openZalo: {
        label: string
        href: string
    }
    authorize:
        | {
              label: string
              isPending: boolean
              isNext: boolean
          }
        | undefined
    authorizeNotice: string
    runAuthorize: () => void
    toggle: (isOpen: boolean) => void
}

/** One setup step of a Zalo OA connection, in the words of the reader, with the command that opens or closes it and the commands it carries. */
export const useZaloSetupStep = (connectionId: string, id: ZaloStepId): UseZaloSetupStepResult => {
    const all = useZaloSetupSteps(connectionId)
    return {
        step: setupStepViewOf(all.steps, id),
        openZalo: all.openZalo,
        authorize: all.authorize,
        authorizeNotice: all.authorizeNotice,
        runAuthorize: all.runAuthorize,
        toggle: (isOpen: boolean): void => all.toggle(id, isOpen),
    }
}
