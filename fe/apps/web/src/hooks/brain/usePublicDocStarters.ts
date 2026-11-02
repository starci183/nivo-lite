"use client"

import {
    useMutateDraftPublicDocumentSwr,
    useMutateRedraftPublicDocumentSwr,
    useMutateWritePublicDocumentSwr,
} from "@/hooks/swr"
import type { MutateDraftPublicDocumentRequest, MutateWritePublicDocumentRequest } from "@/hooks/swr"
import { toPublicDocument } from "@/modules/brain"
import type { Run } from "./usePublicDocRunner"

/** The commands that start a document: NIVO drafts it, the owner writes it, or NIVO drafts it again. */
export const usePublicDocStarters = (run: Run) => {
    const drafting = useMutateDraftPublicDocumentSwr()
    const writing = useMutateWritePublicDocumentSwr()
    const redrafting = useMutateRedraftPublicDocumentSwr()
    return {
        /** NIVO drafts from internal documents; the row appears at once, being drafted. */
        draft: (request: MutateDraftPublicDocumentRequest, done?: string) =>
            run(async () => toPublicDocument(await drafting.trigger(request)), done),
        /** The owner writes the document by hand. */
        write: (request: MutateWritePublicDocumentRequest, done?: string) =>
            run(async () => toPublicDocument(await writing.trigger(request)), done),
        /** NIVO drafts again from the same internal documents. */
        redraft: (id: string, done?: string) =>
            run(async () => toPublicDocument(await redrafting.trigger({ id })), done),
    }
}
