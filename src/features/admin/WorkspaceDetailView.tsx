"use client";

import { Badge, Button, DescriptionList, EmptyNotice, ListItem, SectionHeader, SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common";
import { FACTS_CLASS, GRID_CLASS, ROW_CLASS, ROW_MAIN_CLASS, ROW_META_CLASS } from "./classNames";
import { ago, fmtDate, fmtDateTime, fmtVnd, FLOW_TONE, HEALTH_TONE, MODULE_TONE, STATUS_TONE } from "./format";
import type { WorkspaceDetail } from "./queries";
import { SupportActions } from "./SupportActions";

const None = ({ children }: { readonly children: string }) => <EmptyNotice message={children} />;
/** Raw error text: small, muted, monospaced by its `code` element, wrapping inside the row. */
const Mono = ({ children }: { readonly children: string }) => <Text size="xs"><code>{children}</code></Text>;
/** A fact value at reading weight. */
const Value = ({ children }: { readonly children: React.ReactNode }) => <Text weight="medium">{children}</Text>;

/** Read-only overview of one workspace plus the three confirmed support actions. */
export const WorkspaceDetailView = ({ data, now }: { readonly data: WorkspaceDetail; readonly now: number }) => {
  const { ws } = data;
  return (
    <>
      <SectionHeader level={1} eyebrow="Workspace" title={ws.name} description={`Owner ${ws.ownerEmail} · created ${fmtDate(ws.created_at)} · id ${ws.id}`}
        action={<Button variant="ghost" href="/admin">All workspaces</Button>} />

      <SurfaceCard label="Overview" headingLevel={2}>
        <div className={FACTS_CLASS}>
          <DescriptionList
            layout="columns"
            isDivided
            items={[
              { id: "status", term: "Billing status", description: <Badge tone={STATUS_TONE[ws.status] ?? "neutral"}>{ws.status}</Badge> },
              { id: "plan", term: "Plan", description: <Value>{ws.plan_code ?? "—"}</Value> },
              { id: "paid", term: "Paid until", description: <Value>{fmtDate(ws.paid_until)}</Value> },
              { id: "credits", term: "AI credits this month", description: <Value>{`${Math.round(data.credits.used).toLocaleString("en-US")} / ${data.credits.limit === null ? "no limit" : data.credits.limit.toLocaleString("en-US")}${data.credits.ownLimit === null ? "" : " (own)"}`}</Value> },
              { id: "cost", term: "Model cost this month (USD)", description: <Value>{`$${data.credits.costUsd.toFixed(2)}`}</Value> },
            ]}
          />
          <DescriptionList
            layout="columns"
            isDivided
            items={[
              { id: "members", term: "Members", description: <Value>{data.members.filter((m) => m.status === "active").length}</Value> },
              { id: "last", term: "Last customer message", description: <Value>{ago(data.activity.lastCustomerMessageAt, now)}</Value> },
              { id: "msgs", term: "Messages, 7 days", description: <Value>{data.activity.messages7d}</Value> },
              { id: "decisions", term: "Waiting decisions", description: <Value>{data.activity.openDecisions}</Value> },
              { id: "knowledge", term: "Knowledge sources", description: <Value>{data.knowledge.total}</Value> },
            ]}
          />
        </div>
      </SurfaceCard>

      <SupportActions workspaceId={ws.id} status={ws.status} planCode={ws.plan_code} creditsLimit={data.credits.ownLimit} invites={data.invites.map((i) => ({ id: i.id, email: i.email }))} />

      <div className={GRID_CLASS}>
        <SurfaceListCard label="Members and roles" headingLevel={2}>
          {data.members.map((m) => (
            <ListItem key={m.user_id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}><Text weight="medium">{m.display_name}</Text><Text size="xs" tone="muted">{m.email}</Text></div>
              <div className={ROW_META_CLASS}><Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>{m.status === "disabled" ? <Badge tone="danger">disabled</Badge> : null}</div>
            </ListItem>
          ))}
          {data.invites.map((i) => (
            <ListItem key={i.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}><Text>{i.email}</Text><Text size="xs" tone="muted">{`invited ${fmtDate(i.created_at)} · expires ${fmtDate(i.expires_at)}`}</Text></div>
              <div className={ROW_META_CLASS}><Badge tone="warning">invite pending</Badge><Badge tone="neutral">{i.role}</Badge></div>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Modules" headingLevel={2} empty={<None>No module installed.</None>}>
          {data.modules.map((m) => (
            <ListItem key={m.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}>
                <Text weight="medium">{m.module_key}</Text>
                <Text size="xs" tone="muted">{`${m.contextVersion ? `context v${m.contextVersion} applied ${fmtDate(m.contextAppliedAt)}` : "no context version applied"} · ${m.operating_mode}`}</Text>
                {m.sync ? <Text size="xs" tone="muted">{`OpenClaw ${m.sync.agent_id}: ${m.sync.status}, copy v${m.sync.context_version ?? "—"}, checked ${ago(m.sync.checked_at, now)}`}</Text> : null}
                {m.sync?.error ? <Mono>{m.sync.error}</Mono> : null}
              </div>
              <div className={ROW_META_CLASS}>
                <Badge tone={MODULE_TONE[m.status] ?? "neutral"} isDot={m.live_enabled}>{m.status}</Badge>
                <Badge tone={m.processor === "openclaw" ? "accent" : "neutral"}>{m.processor}</Badge>
                {m.sync ? <Badge tone={m.sync.status === "ok" ? "success" : "danger"}>{`sync ${m.sync.status}`}</Badge> : null}
              </div>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Connections" headingLevel={2} empty={<None>No connection.</None>}>
          {data.connections.map((c) => (
            <ListItem key={c.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}>
                <Text weight="medium">{c.name}</Text>
                <Text size="xs" tone="muted">{`${c.provider} · ${c.environment ?? "live"} · last event ${c.last_event_at ? `${ago(c.last_event_at, now)} (${fmtDateTime(c.last_event_at)})` : "never"}`}</Text>
                {c.last_error ? <Mono>{c.last_error}</Mono> : null}
              </div>
              <div className={ROW_META_CLASS}><Badge tone="neutral">{c.status}</Badge><Badge tone={HEALTH_TONE[c.health]} isDot>{c.health}</Badge></div>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Knowledge sources" headingLevel={2} empty={<None>No knowledge source.</None>}>
          {data.knowledge.byKind.map((k) => (
            <ListItem key={k.kind} className={ROW_CLASS}>
              <Text weight="medium">{k.kind}</Text>
              <div className={ROW_META_CLASS}>{Object.entries(k.byStatus).map(([s, n]) => <Badge key={s} tone={s === "failed" ? "danger" : s === "ready" ? "success" : "neutral"}>{`${s} ${n}`}</Badge>)}</div>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Billing orders" headingLevel={2} empty={<None>No payment order.</None>}>
          {data.orders.map((o) => (
            <ListItem key={o.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}><Text weight="medium">{`${o.order_code} · ${o.plan_code}`}</Text><Text size="xs" tone="muted">{`${fmtVnd(o.amount_vnd)} · created ${fmtDateTime(o.created_at)}${o.paid_at ? ` · paid ${fmtDateTime(o.paid_at)}` : ""}`}</Text></div>
              <Badge tone={FLOW_TONE[o.status] ?? "neutral"}>{o.status}</Badge>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="SePay payments" headingLevel={2} empty={<None>No transfer matched this workspace.</None>}>
          {data.sepay.map((s) => (
            <ListItem key={s.sepay_id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}><Text weight="medium">{fmtVnd(s.transfer_amount)}</Text><Text size="xs" tone="muted">{`${fmtDateTime(s.received_at)} · ${s.content ?? ""}`}</Text></div>
              <Badge tone={FLOW_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
            </ListItem>
          ))}
          {data.billingEvents.map((e) => (
            <ListItem key={e.id} className={ROW_CLASS}>
              <Text size="sm" tone="muted">{`billing event · ${fmtDateTime(e.created_at)}`}</Text>
              <Badge tone={e.kind === "paid" ? "success" : "warning"}>{e.kind}</Badge>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Engine jobs (failed, queued, running)" ariaLabel="Engine jobs" headingLevel={2} empty={<None>Nothing failed or waiting.</None>}>
          {data.jobs.map((j) => (
            <ListItem key={j.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}>
                <Text weight="medium">{j.kind}</Text>
                <Text size="xs" tone="muted">{`${fmtDateTime(j.created_at)} · attempt ${j.attempts}/${j.max_attempts}`}</Text>
                {j.error ? <Mono>{j.error.slice(0, 300)}</Mono> : null}
              </div>
              <Badge tone={FLOW_TONE[j.status] ?? "neutral"}>{j.status}</Badge>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Recent errors" headingLevel={2} empty={<None>No error captured for this workspace.</None>}>
          {data.errors.map((e) => (
            <ListItem key={e.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}><Text size="sm" weight="medium">{e.scope}</Text><Mono>{e.message.slice(0, 300)}</Mono></div>
              <Text size="xs" tone="muted">{fmtDateTime(e.created_at)}</Text>
            </ListItem>
          ))}
        </SurfaceListCard>
      </div>
    </>
  );
};
