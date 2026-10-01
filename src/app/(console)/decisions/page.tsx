import { Decisions } from "@/features/decisions";
import type { Department } from "@/lib/flow-types";

type DecisionsPageProps = { readonly searchParams: Promise<{ kind?: string | string[]; dept?: string | string[] }> };

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
const KINDS = ["policy", "human", "rejected"] as const;
const DEPTS: ReadonlyArray<Department> = ["chatbot", "sales", "accounting"];

/** Decision history. `?kind=policy|human|rejected&dept=chatbot|sales|accounting` filter the list. */
const DecisionsPage = async ({ searchParams }: DecisionsPageProps) => {
  const params = await searchParams;
  const kind = KINDS.find((k) => k === first(params.kind)) ?? null;
  const dept = DEPTS.find((d) => d === first(params.dept)) ?? null;
  return <Decisions kind={kind} dept={dept} />;
};

export default DecisionsPage;
