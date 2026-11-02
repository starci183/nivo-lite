"use client"

import {
    useMutateApprovePublicDocumentSwr,
    useMutateArchivePublicDocumentSwr,
    useMutateUpdatePublicDocumentSwr,
} from "@/hooks/swr"
import type { MutateApprovePublicDocumentRequest, MutateUpdatePublicDocumentRequest } from "@/hooks/swr"
import { toPublicDocument } from "@/modules/brain"
import type { Run } from "./usePublicDocRunner"

/** The commands that decide a document: change its text, approve it, or take it away from customers. */
export const usePublicDocDeciders = (run: Run) => {
    const updating = useMutateUpdatePublicDocumentSwr()
    const approving = useMutateApprovePublicDocumentSwr()
    const archiving = useMutateArchivePublicDocumentSwr()
    return {
        /** Changes the title or the text. */
        update: (request: MutateUpdatePublicDocumentRequest, done?: string) =>
            run(async () => toPublicDocument(await updating.trigger(request)), done),
        /** The owner approves: the document is published to customers. */
        approve: (request: MutateApprovePublicDocumentRequest, done?: string) =>
            run(async () => toPublicDocument(await approving.trigger(request)), done),
        /** Takes the document away from customers. */
        archive: (id: string, done?: string) => run(() => archiving.trigger({ id }), done),
    }
}
