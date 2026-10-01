import { listDecisions } from "@/lib/flow-queries";
import type { DecisionRow, Department } from "@/lib/flow-types";
import { DecisionsView, type DecisionKind } from "./component";

const LIMIT = 100;

/** Props for {@link Decisions}: the already-validated query-string filters. */
export type DecisionsProps = { readonly kind: DecisionKind | null; readonly dept: Department | null };

/** Connected /decisions view: reads `listDecisions`, and still renders if the flow data is not ready. */
export const Decisions = async ({ kind, dept }: DecisionsProps) => {
  let rows: ReadonlyArray<DecisionRow> = [];
  let hasFailed = false;
  try {
    rows = await listDecisions({ kind: kind ?? undefined, department: dept ?? undefined, limit: LIMIT });
  } catch {
    hasFailed = true;
  }
  return <DecisionsView rows={rows} kind={kind} dept={dept} limit={LIMIT} hasFailed={hasFailed} />;
};
