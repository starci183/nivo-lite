"use client"

import {
    useMutateApprovePublicDocumentSwr,
    useMutateArchivePublicDocumentSwr,
    useMutateDraftPublicDocumentSwr,
    useMutateRedraftPublicDocumentSwr,
    useMutateUpdatePublicDocumentSwr,
    useMutateWritePublicDocumentSwr,
} from "@/hooks/swr"
import type {
    MutateApprovePublicDocumentRequest,
    MutateDraftPublicDocumentRequest,
    MutateUpdatePublicDocumentRequest,
    MutateWritePublicDocumentRequest,
} from "@/hooks/swr"
import { documentCommandOf } from "./brain.shared"
import { usePublicDocRunner } from "./usePublicDocRunner"

/** The commands on the documents written for customers; each failure is toasted by the back end's words, and the lists they change are read again. */
export const usePublicDocCommands = () => {
    const { isPending, run } = usePublicDocRunner()
    const drafting = useMutateDraftPublicDocumentSwr()
    const writing = useMutateWritePublicDocumentSwr()
    const redrafting = useMutateRedraftPublicDocumentSwr()
    const updating = useMutateUpdatePublicDocumentSwr()
    const approving = useMutateApprovePublicDocumentSwr()
    const archiving = useMutateArchivePublicDocumentSwr()
    return {
        isPending,
        /** NIVO drafts from internal documents; the row appears at once, being drafted. */
        draft: documentCommandOf(run, (request: MutateDraftPublicDocumentRequest) => drafting.trigger(request)),
        /** The owner writes the document by hand. */
        write: documentCommandOf(run, (request: MutateWritePublicDocumentRequest) => writing.trigger(request)),
        /** NIVO drafts again from the same internal documents. */
        redraft: documentCommandOf(run, (id: string) => redrafting.trigger({ id })),
        /** Changes the title or the text. */
        update: documentCommandOf(run, (request: MutateUpdatePublicDocumentRequest) => updating.trigger(request)),
        /** The owner approves: the document is published to customers. */
        approve: documentCommandOf(run, (request: MutateApprovePublicDocumentRequest) => approving.trigger(request)),
        /** Takes the document away from customers. */
        archive: (id: string, done?: string) => run(() => archiving.trigger({ id }), done),
    }
}
