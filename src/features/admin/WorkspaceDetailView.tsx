"use client";

import { Badge, Button, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { FACT_CLASS, FACTS_CLASS, GRID_CLASS, LIST_CLASS, MONO_CLASS, ROW_CLASS, ROW_MAIN_CLASS, ROW_META_CLASS, STACK_CLASS } from "./classNames";
import { ago, fmtDate, fmtDateTime, fmtVnd, FLOW_TONE, HEALTH_TONE, MODULE_TONE, STATUS_TONE } from "./format";
import type { WorkspaceDetail } from "./queries";
import { SupportActions } from "./SupportActions";

const Fact = ({ label, children }: { readonly label: string; readonly children: React.ReactNode }) => (
  <div className={FACT_CLASS}><Text size="xs" tone="muted">{label}</Text><Text weight="medium">{children}</Text></div>
);

const None = ({ children }: { readonly children: string }) => <Text size="sm" tone="muted">{children}</Text>;

/** Read-only overview of one workspace plus the three confirmed support actions. */
export const WorkspaceDetailView = ({ data, now }: { readonly data: WorkspaceDetail; readonly now: number }) => {
  const { ws } = data;
  return (
    <>
      <SectionHeader level={1} eyebrow="Workspace" title={ws.name} description={`Owner ${ws.ownerEmail} · created ${fmtDate(ws.created_at)} · id ${ws.id}`}
        action={<Button variant="ghost" href="/admin">All workspaces</Button>} />

      <SurfaceCard label="Overview" ariaLabel="Overview">
        <div className={FACTS_CLASS}>
          <Fact label="Billing status"><Badge tone={STATUS_TONE[ws.status] ?? "neutral"}>{ws.status}</Badge></Fact>
          <Fact label="Plan">{ws.plan_code ?? "—"}</Fact>
          <Fact label="Paid until">{fmtDate(ws.paid_until)}</Fact>
          <Fact label="Members">{data.members.filter((m) => m.status === "active").length}</Fact>
          <Fact label="Last customer message">{ago(data.activity.lastCustomerMessageAt, now)}</Fact>
          <Fact label="Messages, 7 days">{data.activity.messages7d}</Fact>
          <Fact label="Waiting decisions">{data.activity.openDecisions}</Fact>
          <Fact label="Knowledge sources">{data.knowledge.total}</Fact>
        </div>
      </SurfaceCard>

      <SupportActions workspaceId={ws.id} status={ws.status} invites={data.invites.map((i) => ({ id: i.id, email: i.email }))} />

      <div className={GRID_CLASS}>
        <SurfaceCard label="Members and roles" ariaLabel="Members and roles">
          <ul className={LIST_CLASS}>
            {data.members.map((m) => (
              <li key={m.user_id} className={ROW_CLASS}>
                <div className={ROW_MAIN_CLASS}><Text weight="medium">{m.display_name}</Text><Text size="xs" tone="muted">{m.email}</Text></div>
                <div className={ROW_META_CLASS}><Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>{m.status === "disabled" ? <Badge tone="danger">disabled</Badge> : null}</div>
              </li>
            ))}
            {data.invites.map((i) => (
              <li key={i.id} className={ROW_CLASS}>
                <div className={ROW_MAIN_CLASS}><Text>{i.email}</Text><Text size="xs" tone="muted">{`invited ${fmtDate(i.created_at)} · expires ${fmtDate(i.expires_at)}`}</Text></div>
                <div className={ROW_META_CLASS}><Badge tone="warning">invite pending</Badge><Badge tone="neutral">{i.role}</Badge></div>
              </li>
            ))}
          </ul>
        </SurfaceCard>

        <SurfaceCard label="Modules" ariaLabel="Modules">
          {data.modules.length === 0 ? <None>No module installed.</None> : (
            <ul className={LIST_CLASS}>
              {data.modules.map((m) => (
                <li key={m.id} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}>
                    <Text weight="medium">{m.module_key}</Text>
                    <Text size="xs" tone="muted">{m.contextVersion ? `context v${m.contextVersion} applied ${fmtDate(m.contextAppliedAt)}` : "no context version applied"} · {m.operating_mode}</Text>
                    {m.sync ? <Text size="xs" tone="muted">{`OpenClaw ${m.sync.agent_id}: ${m.sync.status}, copy v${m.sync.context_version ?? "—"}, checked ${ago(m.sync.checked_at, now)}`}</Text> : null}
                    {m.sync?.error ? <span className={MONO_CLASS}>{m.sync.error}</span> : null}
                  </div>
                  <div className={ROW_META_CLASS}>
                    <Badge tone={MODULE_TONE[m.status] ?? "neutral"} isDot={m.live_enabled}>{m.status}</Badge>
                    <Badge tone={m.processor === "openclaw" ? "accent" : "neutral"}>{m.processor}</Badge>
                    {m.sync ? <Badge tone={m.sync.status === "ok" ? "success" : "danger"}>{`sync ${m.sync.status}`}</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Connections" ariaLabel="Connections">
          {data.connections.length === 0 ? <None>No connection.</None> : (
            <ul className={LIST_CLASS}>
              {data.connections.map((c) => (
                <li key={c.id} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}>
                    <Text weight="medium">{c.name}</Text>
                    <Text size="xs" tone="muted">{`${c.provider} · ${c.environment ?? "live"} · last event ${c.last_event_at ? `${ago(c.last_event_at, now)} (${fmtDateTime(c.last_event_at)})` : "never"}`}</Text>
                    {c.last_error ? <span className={MONO_CLASS}>{c.last_error}</span> : null}
                  </div>
                  <div className={ROW_META_CLASS}><Badge tone="neutral">{c.status}</Badge><Badge tone={HEALTH_TONE[c.health]} isDot>{c.health}</Badge></div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Knowledge sources" ariaLabel="Knowledge sources">
          {data.knowledge.total === 0 ? <None>No knowledge source.</None> : (
            <ul className={LIST_CLASS}>
              {data.knowledge.byKind.map((k) => (
                <li key={k.kind} className={ROW_CLASS}>
                  <Text weight="medium">{k.kind}</Text>
                  <div className={ROW_META_CLASS}>{Object.entries(k.byStatus).map(([s, n]) => <Badge key={s} tone={s === "failed" ? "danger" : s === "ready" ? "success" : "neutral"}>{`${s} ${n}`}</Badge>)}</div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Billing orders" ariaLabel="Billing orders">
          {data.orders.length === 0 ? <None>No payment order.</None> : (
            <ul className={LIST_CLASS}>
              {data.orders.map((o) => (
                <li key={o.id} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}><Text weight="medium">{`${o.order_code} · ${o.plan_code}`}</Text><Text size="xs" tone="muted">{`${fmtVnd(o.amount_vnd)} · created ${fmtDateTime(o.created_at)}${o.paid_at ? ` · paid ${fmtDateTime(o.paid_at)}` : ""}`}</Text></div>
                  <Badge tone={FLOW_TONE[o.status] ?? "neutral"}>{o.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="SePay payments" ariaLabel="SePay payments">
          {data.sepay.length === 0 && data.billingEvents.length === 0 ? <None>No transfer matched this workspace.</None> : (
            <ul className={LIST_CLASS}>
              {data.sepay.map((s) => (
                <li key={s.sepay_id} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}><Text weight="medium">{fmtVnd(s.transfer_amount)}</Text><Text size="xs" tone="muted">{`${fmtDateTime(s.received_at)} · ${s.content ?? ""}`}</Text></div>
                  <Badge tone={FLOW_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                </li>
              ))}
              {data.billingEvents.map((e) => (
                <li key={e.id} className={ROW_CLASS}>
                  <Text size="sm" tone="muted">{`billing event · ${fmtDateTime(e.created_at)}`}</Text>
                  <Badge tone={e.kind === "paid" ? "success" : "warning"}>{e.kind}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Engine jobs (failed, queued, running)" ariaLabel="Engine jobs">
          {data.jobs.length === 0 ? <None>Nothing failed or waiting.</None> : (
            <ul className={LIST_CLASS}>
              {data.jobs.map((j) => (
                <li key={j.id} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}>
                    <Text weight="medium">{j.kind}</Text>
                    <Text size="xs" tone="muted">{`${fmtDateTime(j.created_at)} · attempt ${j.attempts}/${j.max_attempts}`}</Text>
                    {j.error ? <span className={MONO_CLASS}>{j.error.slice(0, 300)}</span> : null}
                  </div>
                  <Badge tone={FLOW_TONE[j.status] ?? "neutral"}>{j.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Recent errors" ariaLabel="Recent errors">
          {data.errors.length === 0 ? <None>No error captured for this workspace.</None> : (
            <div className={STACK_CLASS}>
              <ul className={LIST_CLASS}>
                {data.errors.map((e) => (
                  <li key={e.id} className={ROW_CLASS}>
                    <div className={ROW_MAIN_CLASS}><Text size="sm" weight="medium">{e.scope}</Text><span className={MONO_CLASS}>{e.message.slice(0, 300)}</span></div>
                    <Text size="xs" tone="muted">{fmtDateTime(e.created_at)}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SurfaceCard>
      </div>
    </>
  );
};
