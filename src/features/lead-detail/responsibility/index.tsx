import { getLocale, getT } from "@/i18n/server";
import { lead as leadDict } from "@/i18n/dict/lead";
import type { LeadDetail } from "@/lib/types";
import { ResponsibilityActions } from "./actions";
import { ResponsibilityBase } from "./component";
import { dueFacts, splitResponsibilities, statusLabel } from "./format";

/** Props of the responsibility panel. */
export type ResponsibilityPanelProps = { readonly detail: LeadDetail };

/** P03 panel: the current responsibility with owner, next action, due date and reassign / propose / add actions. */
export const ResponsibilityPanel = async ({ detail }: ResponsibilityPanelProps) => {
  const t = await getT(leadDict);
  const locale = await getLocale();
  const { current, previous } = splitResponsibilities(detail.responsibilities);
  const handle = current?.owner_agent_id
    ? (detail.agents.find((agent) => agent.id === current.owner_agent_id)?.handle ?? null)
    : null;
  return (
    <ResponsibilityBase
      current={current}
      ownerHandle={handle === null ? null : handle.replace(/^@/, "")}
      due={current ? dueFacts(current.due_at, t, locale) : null}
      previous={previous.map((item) => ({
        id: item.id, title: item.title, owner: item.owner_name, status: statusLabel(item.status, t),
      }))}
      actions={<ResponsibilityActions leadId={detail.lead.id} current={current} agents={detail.agents} />}
    />
  );
};
