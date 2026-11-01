import type { PaneGridProps } from "@starci/grammar/common"

/** The arrangement of the panes: the categories beside the dossiers, and the open dossier as a third column from the wide breakpoint. */
export const LAYOUT: Record<"plain" | "withDetail", Required<Pick<PaneGridProps, "areas" | "columns">>> = {
    plain: {
        areas: { base: ["main"], medium: ["list main"] },
        columns: { base: ["fill"], medium: ["standard", "fill"] },
    },
    withDetail: {
        areas: { base: ["main"], medium: ["list main"], wide: ["list main detail"] },
        columns: { base: ["fill"], medium: ["standard", "fill"], wide: ["standard", "fill", "wide"] },
    },
}
