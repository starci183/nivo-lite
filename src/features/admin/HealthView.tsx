"use client";

import { Badge, Button, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common";
import { GRID_CLASS, LIST_CLASS, MONO_CLASS, ROW_CLASS, ROW_MAIN_CLASS, ROW_META_CLASS } from "./classNames";
import { ago, fmtDateTime, fmtVnd, FLOW_TONE } from "./format";
import type { loadHealth } from "./queries";

type Health = Awaited<ReturnType<typeof loadHealth>>;
const None = ({ children }: { readonly children: string }) => <Text size="sm" tone="muted">{children}</Text>;
/** A worker that has not beaten for this long is stale. */
const STALE_MS = 2 * 60_000;

const WorkspaceLink = ({ id, names }: { readonly id: string | null; readonly names: ReadonlyMap<string, string> }) =>
  id ? <Button size="sm" variant="ghost" href={`/admin/${id}`}>{names.get(id) ?? id.slice(0, 8)}</Button> : <Text size="xs" tone="muted">platform</Text>;

/** Platform health: engine workers, queue, failures, sign-ups, billing events, app errors, and the latest audit rows. */
export const HealthView = ({ data, now }: { readonly data: Health; readonly now: number }) => {
  return (
    <>
      <SectionHeader level={1} eyebrow="Platform" title="Platform health" description="Engine workers, queue, failed jobs, sign-ups, SePay billing and application errors." />
      <div className={GRID_CLASS}>
        <SurfaceCard label="Engine workers" ariaLabel="Engine workers">
          {data.workers.length === 0 ? <Badge tone="danger">No worker has ever reported</Badge> : (
            <ul className={LIST_CLASS}>
              {data.workers.map((w) => {
                const stale = now - new Date(w.last_heartbeat_at).getTime() > STALE_MS;
                return (
                  <li key={w.worker_id} className={ROW_CLASS}>
                    <div className={ROW_MAIN_CLASS}><Text weight="medium">{w.worker_id}</Text><Text size="xs" tone="muted">{`v${w.version || "?"} · started ${fmtDateTime(w.started_at)} · ${w.kinds.join(", ") || "all kinds"}`}</Text></div>
                    <div className={ROW_META_CLASS}><Text size="sm">{`heartbeat ${ago(w.last_heartbeat_at, now)}`}</Text><Badge tone={stale ? "danger" : "success"} isDot>{stale ? "stale" : "alive"}</Badge></div>
                  </li>
                );
              })}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Queue depth" ariaLabel="Queue depth">
          {data.queue.length === 0 ? <None>Queue is empty.</None> : (
            <ul className={LIST_CLASS}>
              {data.queue.map((q) => (
                <li key={q.kind} className={ROW_CLASS}>
                  <Text weight="medium">{q.kind}</Text>
                  <div className={ROW_META_CLASS}><Badge tone={q.queued ? "warning" : "neutral"}>{`queued ${q.queued}`}</Badge><Badge tone={q.running ? "accent" : "neutral"}>{`running ${q.running}`}</Badge></div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Failed jobs, last 24h" ariaLabel="Failed jobs, last 24 hours" labelEnd={<Badge tone={data.failed.length ? "danger" : "success"}>{data.failed.length}</Badge>}>
          {data.failed.length === 0 ? <None>No failed job in the last 24 hours.</None> : (
            <ul className={LIST_CLASS}>
              {data.failed.map((j) => (
                <li key={j.id} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}>
                    <Text weight="medium">{j.kind}</Text>
                    {j.error ? <span className={MONO_CLASS}>{j.error.slice(0, 300)}</span> : null}
                  </div>
                  <div className={ROW_META_CLASS}><WorkspaceLink id={j.workspace_id} names={data.workspaceNames} /><Text size="xs" tone="muted">{ago(j.finished_at, now)}</Text></div>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Sign-ups per day (14 days)" ariaLabel="Sign-ups per day">
          {data.signups.length === 0 ? <None>No sign-up in the last 14 days.</None> : (
            <ul className={LIST_CLASS}>
              {data.signups.map((s) => (
                <li key={s.day} className={ROW_CLASS}><Text>{s.day}</Text><Badge tone="accent">{s.signups}</Badge></li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="SePay billing" ariaLabel="SePay billing">
          {data.sepay.length === 0 && data.billingEvents.length === 0 ? <None>No SePay transfer received yet.</None> : (
            <ul className={LIST_CLASS}>
              <li className={ROW_CLASS}>
                <Text size="sm" tone="muted">Last 25 transfers</Text>
                <div className={ROW_META_CLASS}>{data.sepayCounts.map(([s, n]) => <Badge key={s} tone={FLOW_TONE[s] ?? "neutral"}>{`${s} ${n}`}</Badge>)}</div>
              </li>
              {data.sepay.slice(0, 10).map((s, i) => (
                <li key={`${s.received_at}-${i}`} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}><Text weight="medium">{fmtVnd(s.transfer_amount)}</Text><Text size="xs" tone="muted">{`${fmtDateTime(s.received_at)} · ${s.content ?? ""}`}</Text></div>
                  <Badge tone={FLOW_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
                </li>
              ))}
              {data.billingEvents.map((e) => (
                <li key={e.id} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}><Text size="sm" weight="medium">{`billing event: ${e.kind}`}</Text><Text size="xs" tone="muted">{fmtDateTime(e.created_at)}</Text></div>
                  <WorkspaceLink id={e.workspace_id} names={data.workspaceNames} />
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        <SurfaceCard label="Recent admin activity" ariaLabel="Recent admin activity">
          {data.audits.length === 0 ? <None>Nothing yet.</None> : (
            <ul className={LIST_CLASS}>
              {data.audits.map((a) => (
                <li key={a.id} className={ROW_CLASS}>
                  <div className={ROW_MAIN_CLASS}><Text size="sm" weight="medium">{a.action}</Text><Text size="xs" tone="muted">{`${a.actor_email} · ${fmtDateTime(a.created_at)}`}</Text></div>
                  <WorkspaceLink id={a.workspace_id} names={data.workspaceNames} />
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard label="Recent app errors" ariaLabel="Recent app errors" labelEnd={<div className={ROW_META_CLASS}>{data.errorsByScope.map(([s, n]) => <Badge key={s} tone="danger">{`${s} ${n} (24h)`}</Badge>)}</div>}>
        {data.errors.length === 0 ? <None>No error captured yet.</None> : (
          <ul className={LIST_CLASS}>
            {data.errors.map((e) => (
              <li key={e.id} className={ROW_CLASS}>
                <div className={ROW_MAIN_CLASS}><Text size="sm" weight="medium">{e.scope}</Text><span className={MONO_CLASS}>{e.message.slice(0, 400)}</span></div>
                <div className={ROW_META_CLASS}><WorkspaceLink id={e.workspace_id} names={data.workspaceNames} /><Text size="xs" tone="muted">{fmtDateTime(e.created_at)}</Text></div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>
    </>
  );
};
