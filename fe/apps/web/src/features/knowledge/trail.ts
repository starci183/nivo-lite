import type { BreadcrumbItem } from "@starci/grammar/common"

/** The trail of every /knowledge page: Brain > Documents, then the current page when it is deeper than the list. */
export const knowledgeTrail = (labels: { readonly brain: string; readonly docs: string }, current?: string): ReadonlyArray<BreadcrumbItem> => [
  { id: "brain", label: labels.brain, href: "/brain" },
  current === undefined ? { id: "docs", label: labels.docs } : { id: "docs", label: labels.docs, href: "/knowledge" },
  ...(current === undefined ? [] : [{ id: "current", label: current }]),
]
