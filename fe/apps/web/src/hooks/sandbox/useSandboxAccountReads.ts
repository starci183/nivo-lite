"use client"

import { mapSlot, slotOfReads } from "@/hooks/slot"
import {
    useQuerySandboxCallsSwr,
    useQuerySandboxCasesSwr,
    useQuerySandboxKeySwr,
    useQuerySandboxLatestRequestSwr,
    useQuerySandboxNextCasesSwr,
} from "@/hooks/swr"
import { callsDataOf, casesDataOf, type SandboxWords } from "@/modules/sandbox"
import { slotOfSandboxRead } from "./sandbox.shared"
import type { SandboxAccountState } from "./useSandboxAccountState"
import type { DataSlot, SandboxCallsData, SandboxCasesData } from "@/modules/types"

/** The account the blocks are read for: its id and the provider whose cases it answers. */
interface SandboxReadAccount {
    readonly id: string
    readonly provider: string
}

/** What the open account holds, one slot per block, and the ways to read a block again. */
export interface SandboxAccountReads {
    readonly cases: DataSlot<SandboxCasesData>
    readonly calls: DataSlot<SandboxCallsData>
    readonly key: DataSlot<string>
    /** The cases once read: a send takes its inputs from them. */
    readonly casesData: SandboxCasesData | undefined
    /** The key once read: the copy command takes it. */
    readonly keyValue: string | undefined
    readonly retryCases: () => void
    readonly retryCalls: () => void
    readonly retryKey: () => void
}

/**
 * Reads the blocks of one account (its provider's cases, which case answers next, the agent's latest request, its call log, its key)
 * and folds them into the slots the cards draw. Nothing is read while there is no account (`undefined`).
 */
export const useSandboxAccountReads = (
    account: SandboxReadAccount | undefined,
    state: SandboxAccountState,
    words: SandboxWords,
): SandboxAccountReads => {
    const cases = useQuerySandboxCasesSwr(account?.provider)
    const next = useQuerySandboxNextCasesSwr(account?.id)
    const latest = useQuerySandboxLatestRequestSwr(account?.id)
    const calls = useQuerySandboxCallsSwr(account?.id)
    const key = useQuerySandboxKeySwr(account?.id)
    const casesData =
        cases.data === undefined || next.data === undefined || latest.data === undefined
            ? undefined
            : casesDataOf(cases.data, next.data, latest.data, state.edits, words)
    return {
        cases: slotOfReads([cases, next, latest], () => casesData),
        calls: mapSlot(slotOfSandboxRead(calls), (wire) => callsDataOf(wire, state.callsShown, words)),
        key: slotOfSandboxRead(key),
        casesData,
        keyValue: key.data,
        retryCases: () => void Promise.all([cases.mutate(), next.mutate(), latest.mutate()]),
        retryCalls: () => void calls.mutate(),
        retryKey: () => void key.mutate(),
    }
}
