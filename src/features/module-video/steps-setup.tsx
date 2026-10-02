"use client";

import { Button, FileDropzone, Input, SegmentedControl, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { video } from "@/i18n/dict/video";
import { ASPECT_CHOICES, DURATIONS, GOAL_TEMPLATES, type Brand, type Goal, type MediaItem, type ProjectInputs, type SourceChoice } from "@/lib/module-video-shared";
import type { Aspect } from "@/lib/video/spec";
import { BrandCard } from "./brand";
import {
  CHOICES_CLASS_NAME, CHOICE_CLASS_NAME, CHOICE_ON_CLASS_NAME, FOOTER_CLASS_NAME, MEDIA_GRID_CLASS_NAME, MEDIA_IMG_CLASS_NAME, MEDIA_TILE_CLASS_NAME, MEDIA_TILE_ON_CLASS_NAME,
  ROW_CLASS_NAME, SOURCE_CLASS_NAME, STACK_CLASS_NAME, STACK_SM_CLASS_NAME,
} from "./classNames";

/** Step 1: the goal, the frame and the length. */
export const GoalStep = (p: {
  readonly goal: Goal; readonly aspect: Aspect; readonly seconds: number; readonly title: string; readonly canEdit: boolean; readonly busy: boolean; readonly locked: boolean;
  readonly onGoal: (g: Goal) => void; readonly onAspect: (a: Aspect) => void; readonly onSeconds: (n: number) => void; readonly onTitle: (v: string) => void; readonly onNext: () => void;
}) => {
  const t = useT(video);
  const locale = useLocale();
  const off = !p.canEdit || p.locked;
  return (
    <SurfaceCard label={t("goalHeading")}>
      <div className={STACK_CLASS_NAME}>
        <ul className={CHOICES_CLASS_NAME} aria-label={t("goalHeading")}>
          {GOAL_TEMPLATES.map((g) => (
            <li key={g.goal}>
              <button type="button" aria-pressed={p.goal === g.goal} disabled={off} className={p.goal === g.goal ? `${CHOICE_CLASS_NAME} ${CHOICE_ON_CLASS_NAME}` : CHOICE_CLASS_NAME} onClick={() => p.onGoal(g.goal)}>
                <Text as="span" weight="semibold">{g.label[locale]}</Text>
                <Text as="span" size="xs" tone="muted">{g.hint[locale]}</Text>
              </button>
            </li>
          ))}
        </ul>
        <SegmentedControl
          label={t("aspectLabel")} value={p.aspect} isDisabled={off} onValueChange={(v) => p.onAspect(v as Aspect)}
          options={ASPECT_CHOICES.map((a) => ({ value: a.value, label: a[locale] }))}
        />
        <SegmentedControl
          label={t("durationLabel")} value={String(p.seconds)} isDisabled={off} onValueChange={(v) => p.onSeconds(Number(v))}
          options={[...new Set([...DURATIONS, p.seconds])].sort((a, b) => a - b).map((s) => ({ value: String(s), label: t("seconds", { n: s }) }))}
        />
        <Input id="video-title" name="title" label={t("titleLabel")} hint={t("titleHint")} variant="secondary" value={p.title} isDisabled={off} onValueChange={p.onTitle} />
        <div className={FOOTER_CLASS_NAME}>
          <span />
          <Button variant="primary" isPending={p.busy} isDisabled={off} onPress={p.onNext}>{t("next")}</Button>
        </div>
      </div>
    </SurfaceCard>
  );
};

/** Step 2: public knowledge to base the video on, what to stress, photos and clips, and the brand kit. */
export const InputsStep = (p: {
  readonly inputs: ProjectInputs; readonly sources: ReadonlyArray<SourceChoice>; readonly media: ReadonlyArray<MediaItem>; readonly brand: Brand; readonly canEdit: boolean; readonly busy: boolean;
  readonly onInputs: (i: ProjectInputs) => void; readonly onUpload: (files: ReadonlyArray<File>) => void; readonly onBrand: (b: Brand, m: ReadonlyArray<MediaItem>) => void;
  readonly onBack: () => void; readonly onNext: () => void;
}) => {
  const t = useT(video);
  const toggle = (list: ReadonlyArray<string>, id: string): Array<string> => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  return (
    <div className={STACK_CLASS_NAME}>
      <SurfaceCard label={t("inputsHeading")}>
        <div className={STACK_CLASS_NAME}>
          <div className={STACK_SM_CLASS_NAME}>
            <Text weight="semibold">{t("sourcesHeading")}</Text>
            <Text size="xs" tone="muted">{t("sourcesHint")}</Text>
          </div>
          {p.sources.length === 0 ? <Text size="sm" tone="muted">{t("sourcesEmpty")}</Text> : (
            <div className={STACK_SM_CLASS_NAME} role="group" aria-label={t("sourcesHeading")}>
              {p.sources.map((s) => (
                <label key={s.id} className={SOURCE_CLASS_NAME}>
                  <input type="checkbox" checked={p.inputs.sourceIds.includes(s.id)} disabled={!p.canEdit} onChange={() => p.onInputs({ ...p.inputs, sourceIds: toggle(p.inputs.sourceIds, s.id) })} />
                  <span className={STACK_SM_CLASS_NAME}>
                    <Text as="span" weight="medium">{s.topic ? `${s.topic} · ${s.title}` : s.title}</Text>
                    <Text as="span" size="xs" tone="muted" overflow="clamp-2">{s.excerpt}</Text>
                  </span>
                </label>
              ))}
            </div>
          )}
          <Textarea label={t("notesLabel")} description={t("notesHint")} rows={3} maxLength={600} value={p.inputs.notes} isDisabled={!p.canEdit} onValueChange={(v) => p.onInputs({ ...p.inputs, notes: v })} />
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("mediaHeading")} fact={t("mediaHint")}>
        <div className={STACK_CLASS_NAME}>
          {p.media.length === 0 ? <Text size="sm" tone="muted">{t("mediaEmpty")}</Text> : (
            <ul className={MEDIA_GRID_CLASS_NAME} aria-label={t("mediaHeading")}>
              {p.media.filter((m) => m.kind === "image" || m.kind === "video").map((m) => {
                const on = p.inputs.media.includes(m.path);
                return (
                  <li key={m.path}>
                    <button type="button" aria-pressed={on} aria-label={`${t("mediaUse")}: ${m.name}`} disabled={!p.canEdit} className={on ? `${MEDIA_TILE_CLASS_NAME} ${MEDIA_TILE_ON_CLASS_NAME}` : MEDIA_TILE_CLASS_NAME} onClick={() => p.onInputs({ ...p.inputs, media: toggle(p.inputs.media, m.path) })}>
                      {m.url ? (m.kind === "image"
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.url} alt={m.name} className={MEDIA_IMG_CLASS_NAME} />
                        : <video src={`${m.url}#t=0.5`} preload="metadata" muted playsInline aria-label={m.name} className={MEDIA_IMG_CLASS_NAME} />) : <Text size="xs">{m.name}</Text>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {p.canEdit ? <FileDropzone label={t("upload")} accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple hideFileList isDisabled={p.busy} prompt={t("upload")} onFilesChange={p.onUpload} /> : null}
        </div>
      </SurfaceCard>

      <BrandCard brand={p.brand} media={p.media} canEdit={p.canEdit} onSaved={p.onBrand} />

      <div className={FOOTER_CLASS_NAME}>
        <Button variant="ghost" isDisabled={p.busy} onPress={p.onBack}>{t("back")}</Button>
        <div className={ROW_CLASS_NAME}><Button variant="primary" isPending={p.busy} isDisabled={!p.canEdit} onPress={p.onNext}>{t("next")}</Button></div>
      </div>
    </div>
  );
};
