"use client";

import { Alert, Badge, Button, EmptyNotice, ListItem, SectionHeader, SurfaceListCard, Text } from "@starci/grammar/common";
import { GRID_CLASS, ROW_CLASS, ROW_MAIN_CLASS, ROW_META_CLASS } from "./classNames";
import { ago, fmtDateTime, fmtVnd, FLOW_TONE } from "./format";
import type { loadHealth } from "./queries";

type Health = Awaited<ReturnType<typeof loadHealth>>;
const None = ({ children }: { readonly children: string }) => <EmptyNotice message={children} />;
/** Raw error / job text: small, muted, monospaced by its `code` element, wrapping inside the row. */
const Mono = ({ children }: { readonly children: string }) => <Text size="xs"><code>{children}</code></Text>;
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
        <SurfaceListCard label="Engine workers" headingLevel={2} empty={<Alert tone="negative" title="No worker has ever reported" />}>
          {data.workers.map((w) => {
            const stale = now - new Date(w.last_heartbeat_at).getTime() > STALE_MS;
            return (
              <ListItem key={w.worker_id} className={ROW_CLASS}>
                <div className={ROW_MAIN_CLASS}><Text weight="medium">{w.worker_id}</Text><Text size="xs" tone="muted">{`v${w.version || "?"} · started ${fmtDateTime(w.started_at)} · ${w.kinds.join(", ") || "all kinds"}`}</Text></div>
                <div className={ROW_META_CLASS}><Text size="sm">{`heartbeat ${ago(w.last_heartbeat_at, now)}`}</Text><Badge tone={stale ? "danger" : "success"} isDot>{stale ? "stale" : "alive"}</Badge></div>
              </ListItem>
            );
          })}
        </SurfaceListCard>

        <SurfaceListCard label="Queue depth" headingLevel={2} empty={<None>Queue is empty.</None>}>
          {data.queue.map((q) => (
            <ListItem key={q.kind} className={ROW_CLASS}>
              <Text weight="medium">{q.kind}</Text>
              <div className={ROW_META_CLASS}><Badge tone={q.queued ? "warning" : "neutral"}>{`queued ${q.queued}`}</Badge><Badge tone={q.running ? "accent" : "neutral"}>{`running ${q.running}`}</Badge></div>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Failed jobs, last 24h" ariaLabel="Failed jobs, last 24 hours" headingLevel={2} labelEnd={<Badge tone={data.failed.length ? "danger" : "success"}>{data.failed.length}</Badge>} empty={<None>No failed job in the last 24 hours.</None>}>
          {data.failed.map((j) => (
            <ListItem key={j.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}>
                <Text weight="medium">{j.kind}</Text>
                {j.error ? <Mono>{j.error.slice(0, 300)}</Mono> : null}
              </div>
              <div className={ROW_META_CLASS}><WorkspaceLink id={j.workspace_id} names={data.workspaceNames} /><Text size="xs" tone="muted">{ago(j.finished_at, now)}</Text></div>
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Sign-ups per day (14 days)" ariaLabel="Sign-ups per day" headingLevel={2} empty={<None>No sign-up in the last 14 days.</None>}>
          {data.signups.map((s) => (
            <ListItem key={s.day} className={ROW_CLASS}><Text>{s.day}</Text><Badge tone="accent">{s.signups}</Badge></ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="SePay billing" headingLevel={2} empty={<None>No SePay transfer received yet.</None>}>
          {data.sepay.length === 0 && data.billingEvents.length === 0 ? null : (
            <ListItem className={ROW_CLASS}>
              <Text size="sm" tone="muted">Last 25 transfers</Text>
              <div className={ROW_META_CLASS}>{data.sepayCounts.map(([s, n]) => <Badge key={s} tone={FLOW_TONE[s] ?? "neutral"}>{`${s} ${n}`}</Badge>)}</div>
            </ListItem>
          )}
          {data.sepay.slice(0, 10).map((s, i) => (
            <ListItem key={`${s.received_at}-${i}`} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}><Text weight="medium">{fmtVnd(s.transfer_amount)}</Text><Text size="xs" tone="muted">{`${fmtDateTime(s.received_at)} · ${s.content ?? ""}`}</Text></div>
              <Badge tone={FLOW_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
            </ListItem>
          ))}
          {data.billingEvents.map((e) => (
            <ListItem key={e.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}><Text size="sm" weight="medium">{`billing event: ${e.kind}`}</Text><Text size="xs" tone="muted">{fmtDateTime(e.created_at)}</Text></div>
              <WorkspaceLink id={e.workspace_id} names={data.workspaceNames} />
            </ListItem>
          ))}
        </SurfaceListCard>

        <SurfaceListCard label="Recent admin activity" headingLevel={2} empty={<None>Nothing yet.</None>}>
          {data.audits.map((a) => (
            <ListItem key={a.id} className={ROW_CLASS}>
              <div className={ROW_MAIN_CLASS}><Text size="sm" weight="medium">{a.action}</Text><Text size="xs" tone="muted">{`${a.actor_email} · ${fmtDateTime(a.created_at)}`}</Text></div>
              <WorkspaceLink id={a.workspace_id} names={data.workspaceNames} />
            </ListItem>
          ))}
        </SurfaceListCard>
      </div>

      <SurfaceListCard label="Recent app errors" headingLevel={2} labelEnd={<div className={ROW_META_CLASS}>{data.errorsByScope.map(([s, n]) => <Badge key={s} tone="danger">{`${s} ${n} (24h)`}</Badge>)}</div>} empty={<None>No error captured yet.</None>}>
        {data.errors.map((e) => (
          <ListItem key={e.id} className={ROW_CLASS}>
            <div className={ROW_MAIN_CLASS}><Text size="sm" weight="medium">{e.scope}</Text><Mono>{e.message.slice(0, 400)}</Mono></div>
            <div className={ROW_META_CLASS}><WorkspaceLink id={e.workspace_id} names={data.workspaceNames} /><Text size="xs" tone="muted">{fmtDateTime(e.created_at)}</Text></div>
          </ListItem>
        ))}
      </SurfaceListCard>
    </>
  );
};
