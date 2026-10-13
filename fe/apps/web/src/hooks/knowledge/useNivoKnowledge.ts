import { useMemo } from "react"
import { useQueryNivoKnowledgeSwr } from "@/hooks/swr/api/graphql/queries/useQueryNivoKnowledgeSwr"
import { toNivoEntry } from "@/modules/documents"

/** The base knowledge of NIVO every workspace reads, in the shape the blocks know. */
export const useNivoKnowledge = () => {
    const { data, error, isLoading } = useQueryNivoKnowledgeSwr()
    const items = useMemo(() => (data === undefined ? undefined : data.map(toNivoEntry)), [data])
    return { items, error, isLoading }
}
