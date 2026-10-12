"use client";

import { useState } from "react";
import { Badge, Button, DataTable, EmptyNotice, Form, Input, Region, SectionHeader, Text, TextAction, type DataTableColumn } from "@starci/grammar/common";
import { BADGE_WRAP_CLASS, CELL_STACK_CLASS, CHIPS_CLASS, FILTERS_CLASS, SEARCH_FORM_CLASS, STACK_CLASS } from "./classNames";
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

const COLUMNS: ReadonlyArray<DataTableColumn> = [
  { id: "workspace", label: "Workspace", isRowHeader: true },
  { id: "owner", label: "Owner" },
  { id: "billing", label: "Billing" },
  { id: "plan", label: "Plan" },
  { id: "created", label: "Created" },
  { id: "members", label: "Members", align: "end" },
  { id: "modules", label: "Agents" },
  { id: "connections", label: "Connections" },
  { id: "lastMessage", label: "Last customer msg" },
  { id: "messages", label: "Msgs 7d", align: "end" },
  { id: "waiting", label: "Waiting", align: "end" },
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

/** Workspace list: one DataTable row per customer business with billing, modules, connections, activity and what waits on a person. */
export const WorkspacesView = ({ items, filter, q, now }: WorkspacesViewProps) => {
  const [text, setText] = useState(q);
  const shown = items.filter((w) => matches(w, filter, q));
  const count = (f: WorkspaceFilter) => items.filter((w) => matches(w, f, "")).length;

  const renderCell = (w: WorkspaceListItem, columnId: string) => {
    switch (columnId) {
      case "workspace":
        return (
          <div className={CELL_STACK_CLASS}>
            <Button size="sm" variant="ghost" href={`/admin/${w.id}`}>{w.name}</Button>
            {w.attention ? <Badge tone="warning">Needs attention</Badge> : null}
          </div>
        );
      case "owner":
        return <Text size="sm">{w.ownerEmail}</Text>;
      case "billing":
        return (
          <div className={CELL_STACK_CLASS}>
            <Badge tone={STATUS_TONE[w.status] ?? "neutral"}>{w.status}</Badge>
            {w.paidUntil ? <Text size="xs" tone="muted">{`until ${fmtDate(w.paidUntil)}`}</Text> : null}
          </div>
        );
      case "plan":
        return <Text size="sm">{w.planCode ?? "—"}</Text>;
      case "created":
        return <Text size="sm">{fmtDate(w.createdAt)}</Text>;
      case "members":
        return <Text size="sm">{w.members}</Text>;
      case "modules":
        return w.modules.length === 0 ? <Text size="sm" tone="muted">none</Text> : (
          <div className={BADGE_WRAP_CLASS}>
            {w.modules.map((m) => <Badge key={m.key} tone={MODULE_TONE[m.status] ?? "neutral"} isDot={m.live}>{`${m.key}: ${m.status}`}</Badge>)}
          </div>
        );
      case "connections":
        return w.connections.length === 0 ? <Text size="sm" tone="muted">none</Text> : (
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
        );
      case "lastMessage":
        return <Text size="sm">{ago(w.lastCustomerMessageAt, now)}</Text>;
      case "messages":
        return <Text size="sm">{w.messages7d}</Text>;
      default:
        return w.openDecisions > 0 ? <Badge tone="warning">{w.openDecisions}</Badge> : <Text size="sm">0</Text>;
    }
  };

  return (
    <>
      <SectionHeader level={1} eyebrow="Workspaces" title={`${items.length} customer businesses`} description="Billing, agents, connections and activity per workspace. Click a name for the full overview." />
      <div className={FILTERS_CLASS}>
        <Form label="Search workspaces" action="/admin" method="get">
          <div className={SEARCH_FORM_CLASS}>
            <Input id="admin-search" name="q" label="Search name or owner" placeholder="Name, owner email or id" value={text} onValueChange={setText} />
            {/* A non-visual carrier of the active filter for the native GET submit; it draws nothing. */}
            {filter !== "all" ? <input type="hidden" name="f" value={filter} /> : null}
            <Button type="submit" variant="secondary">Search</Button>
          </div>
        </Form>
        <div className={CHIPS_CLASS} role="group" aria-label="Filters">
          {FILTERS.map((f) => (
            <TextAction key={f.key} appearance="choice" size="sm" isCurrent={filter === f.key} href={href(f.key, q)}>{`${f.label} (${count(f.key)})`}</TextAction>
          ))}
        </div>
      </div>
      <Region labelledBy="admin-workspaces-shown" className={STACK_CLASS}>
        <SectionHeader id="admin-workspaces-shown" level={2} title={`${shown.length} shown`} />
        <DataTable
          label="Workspaces"
          columns={COLUMNS}
          rows={shown}
          renderCell={renderCell}
          emptyContent={<EmptyNotice message="No workspace matches" description="Change the filter or the search." />}
        />
      </Region>
    </>
  );
};
