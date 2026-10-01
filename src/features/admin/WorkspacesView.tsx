"use client";

import { useState } from "react";
import { Badge, Button, EmptyNotice, HorizontalScrollRegion, Input, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { BADGE_WRAP_CLASS, CELL_STACK_CLASS, CHIPS_CLASS, FILTERS_CLASS, SEARCH_FORM_CLASS, TABLE_CLASS, TD_CLASS, TD_NUM_CLASS, TH_CLASS } from "./classNames";
import { ago, fmtDate, HEALTH_TONE, MODULE_TONE, STATUS_TONE } from "./format";
import type { WorkspaceListItem } from "./queries";

export type WorkspaceFilter = "all" | "attention" | "unpaid" | "idle";
export type WorkspacesViewProps = { readonly items: ReadonlyArray<WorkspaceListItem>; readonly filter: WorkspaceFilter; readonly q: string; readonly now: number };

const FILTERS: ReadonlyArray<{ key: WorkspaceFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "unpaid", label: "Unpaid" },
  { key: "idle", label: "No activity 7d" },
];

const matches = (w: WorkspaceListItem, filter: WorkspaceFilter, q: string): boolean => {
  if (filter === "attention" && !w.attention) return false;
  if (filter === "unpaid" && !w.unpaid) return false;
  if (filter === "idle" && !w.idle7d) return false;
  const needle = q.trim().toLowerCase();
  return !needle || w.name.toLowerCase().includes(needle) || w.ownerEmail.toLowerCase().includes(needle) || w.id.startsWith(needle);
};

const href = (filter: WorkspaceFilter, q: string) => {
  const p = new URLSearchParams();
  if (filter !== "all") p.set("f", filter);
  if (q) p.set("q", q);
  const s = p.toString();
  return s ? `/admin?${s}` : "/admin";
};

/** Workspace list: one row per customer business with billing, modules, connections, activity and what waits on a person. */
export const WorkspacesView = ({ items, filter, q, now }: WorkspacesViewProps) => {
  const [text, setText] = useState(q);
  const shown = items.filter((w) => matches(w, filter, q));
  const count = (f: WorkspaceFilter) => items.filter((w) => matches(w, f, "")).length;
  return (
    <>
      <SectionHeader level={1} eyebrow="Workspaces" title={`${items.length} customer businesses`} description="Billing, modules, connections and activity per workspace. Click a name for the full overview." />
      <div className={FILTERS_CLASS}>
        <form method="get" action="/admin" className={SEARCH_FORM_CLASS}>
          <Input id="admin-search" name="q" label="Search name or owner" placeholder="Name, owner email or id" value={text} onValueChange={setText} />
          {filter !== "all" ? <input type="hidden" name="f" value={filter} /> : null}
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <div className={CHIPS_CLASS} role="group" aria-label="Filters">
          {FILTERS.map((f) => (
            <Button key={f.key} size="sm" variant={filter === f.key ? "primary" : "outline"} href={href(f.key, q)}>{`${f.label} (${count(f.key)})`}</Button>
          ))}
        </div>
      </div>
      <SurfaceCard label={`${shown.length} shown`} frame="bounded">
        {shown.length === 0 ? (
          <EmptyNotice message="No workspace matches" description="Change the filter or the search." />
        ) : (
          <HorizontalScrollRegion isFocusable>
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  {["Workspace", "Owner", "Billing", "Plan", "Created", "Members", "Modules", "Connections", "Last customer msg", "Msgs 7d", "Waiting"].map((h) => (
                    <th key={h} scope="col" className={TH_CLASS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((w) => (
                  <tr key={w.id}>
                    <td className={TD_CLASS}>
                      <div className={CELL_STACK_CLASS}>
                        <Button size="sm" variant="ghost" href={`/admin/${w.id}`}>{w.name}</Button>
                        {w.attention ? <Badge tone="warning">Needs attention</Badge> : null}
                      </div>
                    </td>
                    <td className={TD_CLASS}><Text size="sm">{w.ownerEmail}</Text></td>
                    <td className={TD_CLASS}>
                      <div className={CELL_STACK_CLASS}>
                        <Badge tone={STATUS_TONE[w.status] ?? "neutral"}>{w.status}</Badge>
                        {w.paidUntil ? <Text size="xs" tone="muted">until {fmtDate(w.paidUntil)}</Text> : null}
                      </div>
                    </td>
                    <td className={TD_CLASS}><Text size="sm">{w.planCode ?? "—"}</Text></td>
                    <td className={TD_CLASS}><Text size="sm">{fmtDate(w.createdAt)}</Text></td>
                    <td className={TD_NUM_CLASS}>{w.members}</td>
                    <td className={TD_CLASS}>
                      {w.modules.length === 0 ? <Text size="sm" tone="muted">none</Text> : (
                        <div className={BADGE_WRAP_CLASS}>
                          {w.modules.map((m) => <Badge key={m.key} tone={MODULE_TONE[m.status] ?? "neutral"} isDot={m.live}>{`${m.key}: ${m.status}`}</Badge>)}
                        </div>
                      )}
                    </td>
                    <td className={TD_CLASS}>
                      {w.connections.length === 0 ? <Text size="sm" tone="muted">none</Text> : (
                        <div className={CELL_STACK_CLASS}>
                          <div className={BADGE_WRAP_CLASS}>
                            {w.connections.map((c) => <Badge key={c.provider} tone="neutral">{`${c.provider} × ${c.count}`}</Badge>)}
                          </div>
                          {w.connections.filter((c) => c.error + c.silent > 0).map((c) => (
                            <Badge key={`warn-${c.provider}`} tone={c.error ? HEALTH_TONE.error : HEALTH_TONE.silent}>
                              {`${c.provider}: ${[c.error ? `${c.error} error` : "", c.silent ? `${c.silent} silent` : ""].filter(Boolean).join(", ")}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={TD_CLASS}><Text size="sm">{ago(w.lastCustomerMessageAt, now)}</Text></td>
                    <td className={TD_NUM_CLASS}>{w.messages7d}</td>
                    <td className={TD_NUM_CLASS}>{w.openDecisions > 0 ? <Badge tone="warning">{w.openDecisions}</Badge> : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalScrollRegion>
        )}
      </SurfaceCard>
    </>
  );
};
