import { LIST_MAX } from "../schema/bounds"
import { catalogSnapshotSchema } from "./catalog.schema"
import type { CatalogSnapshot } from "./catalog.types"

/** The outcome of reading the catalog jsonb: the snapshot, or the issues that refused it. */
export type CatalogParse =
    | { readonly ok: true; readonly snapshot: CatalogSnapshot }
    | { readonly ok: false; readonly issues: ReadonlyArray<string> }

/** Parse the catalog jsonb; the issues are `path: message` lines, at most `LIST_MAX`. */
export const parseCatalogSnapshot = (value: unknown): CatalogParse => {
    const result = catalogSnapshotSchema.safeParse(value)
    if (result.success) return { ok: true, snapshot: result.data }
    return {
        ok: false,
        issues: result.error.issues.slice(0, LIST_MAX).map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    }
}
