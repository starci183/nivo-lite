import { create } from "zustand"

/** Feature-local state shared by the Hiring tabs: the job the candidates tab filters on and the candidate whose drawer is open. */
interface HiringBenchState {
    readonly jobId: string
    /** Undefined: nobody chose yet, the `?focus=` link decides; null: the drawer was closed. */
    readonly openId: string | null | undefined
    readonly setJobId: (id: string) => void
    readonly open: (candidateId: string) => void
    readonly close: () => void
}

/** The store of the Hiring tabs' shared selection. */
export const useHiringBenchStore = create<HiringBenchState>((set) => ({
    jobId: "all",
    openId: undefined,
    setJobId: (id) => set({ jobId: id }),
    open: (candidateId) => set({ openId: candidateId }),
    close: () => set({ openId: null }),
}))
