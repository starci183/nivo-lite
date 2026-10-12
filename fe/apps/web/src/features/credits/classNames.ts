import { cn } from "@heroui/react";

/** Page regions under the header (GAP-5). */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
/** Breadcrumb trail above the page heading: one heading block (GAP-2). */
export const HEAD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2");
/** Blocks inside one card (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
/** Lines of one entry (GAP-1). */
export const COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");
/** Figure beside its status badge (GAP-2). */
export const FIGURE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");
/** Two peer columns from lg, stacked below; minmax(0, 1fr) lets either column shrink inside a narrow container (GAP-5). */
export const COLUMNS_CLASS_NAME = cn("grid", "grid-cols-1", "items-start", "gap-6", "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
/** One column of the pair: its cards stacked (GAP-4). */
export const COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/* Payment drawer. */
/** QR code over the transfer details (GAP-4). */
export const PAY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");
/** QR code, its title and the countdown (GAP-4). */
export const QR_WRAP_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-3");
// grammar gap: the QR frame has no size prop; the same bounded width the onboarding payment screen gives its QR.
/** Width of the QR MediaFrame. */
export const QR_CLASS_NAME = cn("w-full", "max-w-64");
