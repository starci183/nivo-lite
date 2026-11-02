"use client"

import useSWRMutation from "swr/mutation"
import { mutateArchivePublicDocument } from "@/modules/api/graphql/mutations/mutation-archive-public-document"
import type { MutateArchivePublicDocumentRequest } from "@/modules/api/graphql/mutations/mutation-archive-public-document"

/** What the ArchivePublicDocument mutation is triggered with. */
interface ArchivePublicDocumentArg {
    readonly arg: MutateArchivePublicDocumentRequest
}

/** The SWR key of the archivePublicDocument mutation. */
export const MUTATE_ARCHIVE_PUBLIC_DOCUMENT_SWR_KEY = "MUTATE_ARCHIVE_PUBLIC_DOCUMENT_SWR"

/** SWR mutation for {@link mutateArchivePublicDocument}: Takes a public document away from customers. `trigger(input)` rejects with the back end failure. */
export const useMutateArchivePublicDocumentSwr = () =>
    useSWRMutation(MUTATE_ARCHIVE_PUBLIC_DOCUMENT_SWR_KEY, async (_key: string, { arg }: ArchivePublicDocumentArg) => {
        const result = await mutateArchivePublicDocument({ request: arg })
        if (!result.data) throw new Error("archivePublicDocument answered no data")
        return result.data.archivePublicDocument
    })
