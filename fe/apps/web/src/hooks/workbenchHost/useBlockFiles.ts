"use client"

import { useMemo } from "react"
import type { BlockFileStore } from "@nivo-lite/agent-sdk/block"
import {
    useMutateFileConfirmSwr,
    useMutateFileDeleteSwr,
    useMutateFileLinkSwr,
    useMutateFileUploadSwr,
    useMutateFileUrlSwr,
    usePutPresignedSwr,
} from "@/hooks/swr"
import { fileRefOf, fileTicketOf, signedFileUrlOf } from "@/modules/workbench-host"

/**
 * The file store of the block host, over the back end door's five file operations: an upload is the ticket, the browser's PUT to the
 * presigned address (with progress), the confirmation and the link; an address and a removal are one call each. Every call is made for
 * the read or action `via` the renderer closes it over, which the door grants it by; a refusal rejects with the back end's failure and
 * the block words it. A list field's file is named by `key`.
 */
export const useBlockFiles = (): BlockFileStore => {
    const { trigger: requestTicket } = useMutateFileUploadSwr()
    const { trigger: confirm } = useMutateFileConfirmSwr()
    const { trigger: link } = useMutateFileLinkSwr()
    const { trigger: requestUrl } = useMutateFileUrlSwr()
    const { trigger: remove } = useMutateFileDeleteSwr()
    const { trigger: putFile } = usePutPresignedSwr()
    return useMemo<BlockFileStore>(
        () => ({
            upload: async (via, type, recordId, field, file, options) => {
                const call = { via, type, recordId, field }
                const ticket = fileTicketOf(
                    await requestTicket({ ...call, name: file.name, mime: file.type, size: file.size }),
                )
                await putFile({
                    url: ticket.url,
                    file,
                    contentType: file.type,
                    headers: ticket.headers,
                    ...(options?.onProgress === undefined ? {} : { onProgress: options.onProgress }),
                })
                const confirmed = fileRefOf(await confirm({ ...call, key: ticket.key, name: file.name }))
                return fileRefOf(await link({ ...call, key: confirmed.key, name: confirmed.name }))
            },
            url: async (via, type, recordId, field, key) =>
                signedFileUrlOf(await requestUrl({ via, type, recordId, field, ...(key === undefined ? {} : { key }) })),
            remove: async (via, type, recordId, field, key) => {
                await remove({ via, type, recordId, field, ...(key === undefined ? {} : { key }) })
            },
        }),
        [requestTicket, putFile, confirm, link, requestUrl, remove],
    )
}
