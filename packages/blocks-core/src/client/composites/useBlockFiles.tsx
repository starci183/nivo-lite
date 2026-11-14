import { useEffect } from "react"
import { useBlockHost, useNodeFiles } from "@nivo-lite/agent-sdk/client"
import type { BlockFiles } from "@nivo-lite/agent-sdk/block"

/** The defect a block reports when its host has no file store behind it. */
export const FILES_MISSING_DEFECT = "BLOCK_FILES_MISSING"

/**
 * The file port of the node being drawn (record and field only; the host makes each call for the read or action the spec bound to the
 * node's `record` and `write` slots); null on a host with no file store, which it reports once for `blockId` so the block draws no
 * control that would do nothing.
 */
export const useBlockFiles = (blockId: string): BlockFiles | null => {
    const host = useBlockHost()
    const files = useNodeFiles()
    useEffect(() => {
        if (files === null) host.report(FILES_MISSING_DEFECT, blockId)
    }, [files, host, blockId])
    return files
}
