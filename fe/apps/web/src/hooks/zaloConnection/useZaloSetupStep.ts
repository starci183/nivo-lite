"use client"

import { setupStepViewOf } from "@/hooks/connectionPage"
import type { ZaloStepId } from "@/modules/types"
import { useZaloSetupSteps } from "./useZaloSetupSteps"

/** One setup step of a Zalo OA connection, in the words of the reader, with the command that opens or closes it and the commands it carries. */
export const useZaloSetupStep = (connectionId: string, id: ZaloStepId) => {
    const all = useZaloSetupSteps(connectionId)
    return {
        step: setupStepViewOf(all.steps, id),
        openZalo: all.openZalo,
        authorize: all.authorize,
        authorizeNotice: all.authorizeNotice,
        runAuthorize: all.runAuthorize,
        toggle: (isOpen: boolean) => all.toggle(id, isOpen),
    }
}
