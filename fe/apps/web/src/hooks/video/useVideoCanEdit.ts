import { useQueryVideoScopeSwr } from "@/hooks/swr/api/graphql/queries/useQueryVideoScopeSwr"

/** Whether the member may create and change videos. */
export const useVideoCanEdit = (): boolean => useQueryVideoScopeSwr().data?.canEdit ?? false
