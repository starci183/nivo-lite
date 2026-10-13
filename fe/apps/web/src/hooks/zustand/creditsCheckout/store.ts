import { create } from "zustand"
import type { PayTarget } from "@/modules/types"

interface CreditsCheckoutState {
    readonly target: PayTarget | null
    readonly workspaceId: string | undefined
    readonly orderId: string | undefined
    readonly requestHandler: ((target: PayTarget) => Promise<void>) | undefined
    readonly isRequesting: boolean
    readonly error: string | null
    readonly open: (workspaceId: string, target: PayTarget) => void
    readonly update: (orderId: string | undefined, isRequesting: boolean, error: string | null) => void
    readonly registerRequest: (requestHandler: ((target: PayTarget) => Promise<void>) | undefined) => void
    readonly close: () => void
}

/** The selected credit purchase and its payment drawer progress. */
export const useCreditsCheckoutStore = create<CreditsCheckoutState>((set) => ({
    target: null,
    workspaceId: undefined,
    orderId: undefined,
    requestHandler: undefined,
    isRequesting: false,
    error: null,
    open: (workspaceId, target) =>
        set({
            workspaceId,
            target,
            orderId: undefined,
            isRequesting: true,
            error: null,
        }),
    update: (orderId, isRequesting, error) => set({ orderId, isRequesting, error }),
    registerRequest: (requestHandler) => set({ requestHandler }),
    close: () => set({ target: null, workspaceId: undefined, orderId: undefined, isRequesting: false, error: null }),
}))
