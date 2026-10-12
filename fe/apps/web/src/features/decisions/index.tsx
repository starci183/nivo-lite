import { listDecisions } from "@/lib/flow-queries";
import type { Department } from "@/lib/flow-types";
import { DecisionsView, type DecisionKind } from "./component";

const LIMIT = 100;

/** Props for {@link Decisions}: the already-validated query-string filters. */
export type DecisionsProps = { readonly kind: DecisionKind | null; readonly dept: Department | null };

/** Connected /decisions view: reads `listDecisions`. A failed read is logged and rethrown so the route's error view shows (STATE-8 case-4). */
export const Decisions = async ({ kind, dept }: DecisionsProps) => {
  try {
    const rows = await listDecisions({ kind: kind ?? undefined, department: dept ?? undefined, limit: LIMIT });
    return <DecisionsView rows={rows} kind={kind} dept={dept} limit={LIMIT} />;
  } catch (error) {
    console.error("[decisions] load failed", error);
    throw error;
  }
};
