"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, EmptyNotice, List, ListItem, MediaFrame, SectionHeader, SurfaceCard, Text, type BadgeTone, type DescriptionListStatItem } from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useLocale, useT } from "@/i18n/client";
import { video } from "@/i18n/dict/video";
import { workbenchFigures } from "@/i18n/dict/workbenchFigures";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import type { VideoFigures } from "@/lib/workbench-video";
import { templateOf, type Brand, type MediaItem, type ProjectStatus, type ProjectView } from "@/lib/module-video-shared";
import { archiveVideo, duplicateVideo, listVideos, type Snapshot } from "./actions";
import { BrandCard } from "./brand";
import { GRID_CLASS_NAME, GRID_ITEM_CLASS_NAME, PAGE_CLASS_NAME, ROW_CLASS_NAME, STACK_CLASS_NAME, STACK_SM_CLASS_NAME } from "./classNames";
import { Editor } from "./editor";

const STATUS_TONE: Record<ProjectStatus, BadgeTone> = { draft: "neutral", scripting: "accent", rendering: "accent", ready: "warning", approved: "success", published: "success", archived: "neutral" };

/** Props for {@link VideoWorkbenchView}. */
export type VideoWorkbenchViewProps = {
  readonly initial: Snapshot | null;
  /** Owner or manager: may create, render and approve. Others only look. */
  readonly canEdit: boolean;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** The ribbon's four figures; null when they could not be read. */
  readonly figures: VideoFigures | null;
  /** The tab named in `?tab=`, already read on the server. */
  readonly initialTab: string | null;
};

const Card = ({ p, canEdit, busy, onOpen, onDuplicate, onArchive }: {
  readonly p: ProjectView; readonly canEdit: boolean; readonly busy: boolean; readonly onOpen: () => void; readonly onDuplicate: () => void; readonly onArchive: () => void;
}) => {
  const t = useT(video);
  const locale = useLocale();
  const r = p.render;
  return (
    <ListItem className={GRID_ITEM_CLASS_NAME}>
      <SurfaceCard ariaLabel={p.title} height="fill">
        <div className={STACK_CLASS_NAME}>
          {r?.posterUrl ? (
            <MediaFrame aspect="landscape" fit="contain">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.posterUrl} alt={p.title} />
            </MediaFrame>
          ) : <Text size="sm" tone="muted">{r?.status === "rendering" || r?.status === "queued" ? t("status_rendering") : t("notRendered")}</Text>}
          <div className={STACK_SM_CLASS_NAME}>
            <Text weight="semibold" overflow="clamp-2">{p.title}</Text>
            <div className={ROW_CLASS_NAME}>
              <Badge tone={STATUS_TONE[p.status]}>{t(`status_${p.status}`)}</Badge>
              <Badge tone="neutral">{templateOf(p.goal).label[locale]}</Badge>
              <Badge tone="neutral">{p.aspect}</Badge>
            </div>
            <Text size="xs" tone="muted">
              {r?.durationMs ? t("seconds", { n: Math.round(r.durationMs / 1000) }) : t("seconds", { n: p.targetSeconds })}
              {p.renderCount > 0 ? ` · ${t("renders", { n: p.renderCount })}` : ""}
              {` · ${t("views")}: ${t("viewsNone")}`}
            </Text>
          </div>
          <div className={ROW_CLASS_NAME}>
            <Button size="sm" variant="outline" onPress={onOpen}>{t("open")}</Button>
            {canEdit ? <Button size="sm" variant="secondary" isDisabled={busy} onPress={onDuplicate}>{t("duplicate")}</Button> : null}
            {canEdit ? <Button size="sm" variant="ghost" isDisabled={busy || p.status === "scripting" || p.status === "rendering"} onPress={onArchive}>{t("archive")}</Button> : null}
          </div>
        </div>
      </SurfaceCard>
    </ListItem>
  );
};

/** The Tạo video workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around the video library and the brand kit; the wizard takes the page over. */
export const VideoWorkbenchView = ({ initial, canEdit, dashboard, figures, initialTab }: VideoWorkbenchViewProps) => {
  const t = useT(video);
  const tf = useT(workbenchFigures);
  const router = useRouter();
  const [projects, setProjects] = useState<ReadonlyArray<ProjectView>>(initial?.projects ?? []);
  const [brand, setBrand] = useState<Brand | null>(initial?.brand ?? null);
  const [media, setMedia] = useState<ReadonlyArray<MediaItem>>(initial?.media ?? []);
  const [open, setOpen] = useState<{ readonly project: ProjectView | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const r = await listVideos();
    if (r.ok) setProjects(r.data);
  }, []);

  // Videos still rendering or being scripted while the library is shown: look again every few seconds.
  const working = projects.some((p) => p.status === "scripting" || p.status === "rendering");
  useEffect(() => {
    if (open || !working) return;
    const id = window.setInterval(() => { void reload(); }, 4000);
    return () => window.clearInterval(id);
  }, [open, working, reload]);

  // When the last working video settles, the ribbon (counts by status) and the frame's lists are read again on the server.
  const wasWorking = useRef(working);
  useEffect(() => {
    if (wasWorking.current && !working) router.refresh();
    wasWorking.current = working;
  }, [working, router]);

  const upsert = useCallback((p: ProjectView) => setProjects((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list])), []);

  if (!initial || !brand) return null;

  if (open) {
    return (
      <Editor
        key={open.project?.id ?? "new"} project={open.project} brand={brand} sources={initial.sources} media={media} canEdit={canEdit}
        onMedia={setMedia} onBrand={(b, m) => { setBrand(b); setMedia(m); }} onProject={upsert}
        onClose={() => { setOpen(null); void reload(); router.refresh(); }}
      />
    );
  }

  const act = async (fn: () => Promise<{ readonly ok: boolean; readonly error?: string }>) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    if (!r.ok) setError(t("actionFailed", { error: r.error ?? "" }));
    await reload();
    router.refresh();
    setBusy(false);
  };

  const ribbon: ReadonlyArray<DescriptionListStatItem> = figures
    ? [
      { id: "rendering", term: tf("vdRendering"), description: String(figures.rendering), meta: tf("vdRenderingMeta", { n: figures.scripting }) },
      { id: "ready", term: tf("vdReady"), description: String(figures.readyToPublish), meta: tf("vdReadyMeta", { approved: figures.approved }) },
      { id: "published", term: tf("vdPublished"), description: String(figures.published30), meta: tf("vdPublishedMeta") },
      { id: "credits", term: tf("vdCredits"), description: String(figures.credits30), meta: tf("vdCreditsMeta") },
    ]
    : [];

  const library = (
    <div className={STACK_CLASS_NAME}>
      {!canEdit ? <Alert tone="cautionary" title={t("viewOnly")} /> : null}
      {error ? <Alert tone="negative" title={error} dismissLabel={t("back")} onDismiss={() => setError(null)} /> : null}
      <SectionHeader level={2} title={t("tabLibrary")} meta={t("libraryCount", { n: projects.length })} />
      {projects.length === 0 ? (
        <SurfaceCard ariaLabel={t("libraryEmptyTitle")}>
          <EmptyNotice
            message={t("libraryEmptyTitle")} description={t("libraryEmptyBody")}
            {...(canEdit ? { actionLabel: t("newVideo"), onAction: () => setOpen({ project: null }) } : {})}
          />
        </SurfaceCard>
      ) : (
        <List className={GRID_CLASS_NAME} label={t("tabLibrary")}>
          {projects.map((p) => (
            <Card
              key={p.id} p={p} canEdit={canEdit} busy={busy} onOpen={() => setOpen({ project: p })}
              onDuplicate={() => { void act(async () => { const r = await duplicateVideo(p.id); if (r.ok) upsert(r.data); return r; }); }}
              onArchive={() => { void act(() => archiveVideo(p.id, true)); }}
            />
          ))}
        </List>
      )}
    </div>
  );

  return (
    <AgentDashboardFrame
      module="video"
      data={dashboard}
      figures={ribbon}
      figuresFailed={figures === null}
      command={canEdit ? <Button variant="primary" onPress={() => setOpen({ project: null })}>{t("newVideo")}</Button> : undefined}
      initialTab={initialTab}
      tabs={[
        { id: "library", label: tf("vdTabLibrary"), content: library },
        { id: "brand", label: tf("vdTabBrand"), content: <BrandCard brand={brand} media={media} canEdit={canEdit} onSaved={(b, m) => { setBrand(b); setMedia(m); }} /> },
      ]}
    />
  );
};
