import { create } from "zustand"

/** An approval stays locked across workbench remounts until the backend reports its terminal result. */
interface LeadGenApproval {
    readonly workItemId: string
    readonly jobId?: string
    readonly requesting: boolean
    readonly pending: boolean
    readonly terminalReported?: "succeeded" | "failed"
    readonly readErrorReported: boolean
}

interface LeadGenApprovalStore {
    readonly approvals: Readonly<Record<string, LeadGenApproval>>
    readonly claim: (scopeId: string, workItemId: string) => boolean
    readonly accepted: (scopeId: string, workItemId: string, jobId: string) => void
    readonly refused: (scopeId: string, workItemId: string) => void
    readonly reportReadError: (scopeId: string, jobId: string) => boolean
    readonly finish: (scopeId: string, jobId: string, status: "succeeded" | "failed") => boolean
}

/** Browser-lifetime state of public-reply approvals, scoped by workspace and signed-in user, independent of each instance's editor. */
export const useLeadGenApprovalStore = create<LeadGenApprovalStore>((set, get) => ({
    approvals: {},
    claim: (scopeId, workItemId) => {
        if (get().approvals[scopeId]?.pending) return false
        set((state) => ({
            approvals: {
                ...state.approvals,
                [scopeId]: { workItemId, requesting: true, pending: true, readErrorReported: false },
            },
        }))
        return true
    },
    accepted: (scopeId, workItemId, jobId) =>
        set((state) => {
            const approval = state.approvals[scopeId]
            if (!approval?.requesting || approval.workItemId !== workItemId) return state
            return {
                approvals: {
                    ...state.approvals,
                    [scopeId]: { ...approval, jobId, requesting: false },
                },
            }
        }),
    refused: (scopeId, workItemId) =>
        set((state) => {
            const approval = state.approvals[scopeId]
            if (!approval?.requesting || approval.workItemId !== workItemId) return state
            return {
                approvals: {
                    ...state.approvals,
                    [scopeId]: { ...approval, requesting: false, pending: false },
                },
            }
        }),
    reportReadError: (scopeId, jobId) => {
        const approval = get().approvals[scopeId]
        if (!approval?.pending || approval.jobId !== jobId || approval.readErrorReported) return false
        set((state) => ({
            approvals: { ...state.approvals, [scopeId]: { ...approval, readErrorReported: true } },
        }))
        return true
    },
    finish: (scopeId, jobId, status) => {
        const approval = get().approvals[scopeId]
        if (!approval || approval.jobId !== jobId || approval.terminalReported === status) return false
        set((state) => ({
            approvals: {
                ...state.approvals,
                [scopeId]: { ...approval, pending: false, terminalReported: status },
            },
        }))
        return true
    },
}))
