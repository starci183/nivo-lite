"use client"

import useSWRMutation from "swr/mutation"
import { mutateCreateKnowledgeUpload } from "@/modules/api/graphql/mutations/mutation-create-knowledge-upload"
import type { MutateCreateKnowledgeUploadRequest } from "@/modules/api/graphql/mutations/mutation-create-knowledge-upload"

/** What the CreateKnowledgeUpload mutation is triggered with. */
interface CreateKnowledgeUploadArg {
    readonly arg: MutateCreateKnowledgeUploadRequest
}

/** The SWR key of the createKnowledgeUpload mutation. */
export const MUTATE_CREATE_KNOWLEDGE_UPLOAD_SWR_KEY = "MUTATE_CREATE_KNOWLEDGE_UPLOAD_SWR"

/** SWR mutation for {@link mutateCreateKnowledgeUpload}: Asks for the presigned address one document upload goes to. `trigger(input)` rejects with the back end failure. */
export const useMutateCreateKnowledgeUploadSwr = () =>
    useSWRMutation(MUTATE_CREATE_KNOWLEDGE_UPLOAD_SWR_KEY, async (_key: string, { arg }: CreateKnowledgeUploadArg) => {
        const result = await mutateCreateKnowledgeUpload({ request: arg })
        if (!result.data) throw new Error("createKnowledgeUpload answered no data")
        return result.data.createKnowledgeUpload
    })
