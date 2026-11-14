import { useEffect, useState } from "react"
import type { BlockFiles } from "@nivo-lite/agent-sdk/block"
import { refreshWaitOf } from "../../rows/file-field"

/** The file whose address is wanted. */
export interface SignedFileTarget {
    /** The record type of the record. */
    readonly type: string
    /** The id of the record. */
    readonly id: string
    /** The file field of the record type. */
    readonly field: string
    /** What the file is now (its object key): a new one is a new file, so its address is asked again. */
    readonly version: string
    /** A list field: the object key of the file whose address is wanted; absent for a field of one file. */
    readonly item?: string
}

/** The address of a file as the block holds it. */
export interface SignedFileAddress {
    /** The signed address; null until the host answers, and after it failed. */
    readonly url: string | null
    /** True when the host refused the address. */
    readonly isFailed: boolean
}

/** What the state remembers: the answer and the file it was for. */
interface Answer {
    readonly forKey: string
    readonly address: SignedFileAddress
}

const keyOf = (target: SignedFileTarget): string => `${target.type}/${target.id}/${target.field}/${target.version}`

const PENDING: SignedFileAddress = { url: null, isFailed: false }

/**
 * The short-lived signed address of the file on a record field, asked from the host's file port and asked again before it
 * expires. It is pending (no url, not failed) until the host answers, and again when the file changes. A null target or a
 * missing port asks nothing.
 */
export const useSignedFileUrl = (files: BlockFiles | null, target: SignedFileTarget | null): SignedFileAddress => {
    const [answer, setAnswer] = useState<Answer | null>(null)
    const key = target === null ? null : keyOf(target)
    const type = target?.type
    const id = target?.id
    const field = target?.field
    const item = target?.item
    useEffect(() => {
        if (files === null || key === null || type === undefined || id === undefined || field === undefined) return undefined
        let isLive = true
        let timer: ReturnType<typeof setTimeout> | undefined
        const ask = (): void => {
            files
                .url(type, id, field, item)
                .then((signed) => {
                    if (!isLive) return
                    setAnswer({ forKey: key, address: { url: signed.url, isFailed: false } })
                    timer = setTimeout(ask, refreshWaitOf(signed.expiresAt, Date.now()))
                })
                .catch(() => {
                    if (isLive) setAnswer({ forKey: key, address: { url: null, isFailed: true } })
                })
        }
        ask()
        return () => {
            isLive = false
            clearTimeout(timer)
        }
    }, [files, key, type, id, field, item])
    return answer !== null && answer.forKey === key ? answer.address : PENDING
}
