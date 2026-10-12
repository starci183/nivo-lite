"use client";

import { Button, Checkbox, CheckboxGroup, FileDropzone, Input, List, ListItem, MediaFrame, RadioGroup, SegmentedControl, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { video } from "@/i18n/dict/video";
import { ASPECT_CHOICES, DURATIONS, GOAL_TEMPLATES, type Brand, type Goal, type MediaItem, type ProjectInputs, type SourceChoice } from "@/lib/module-video-shared";
import type { Aspect } from "@/lib/video/spec";
import { BrandCard } from "./brand";
import { FOOTER_CLASS_NAME, FOOTER_END_CLASS_NAME, MEDIA_GRID_CLASS_NAME, ROW_CLASS_NAME, STACK_CLASS_NAME, STACK_SM_CLASS_NAME } from "./classNames";

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
        <RadioGroup
          label={t("goalHeading")} isLabelHidden variant="secondary" value={p.goal} isDisabled={off}
          options={GOAL_TEMPLATES.map((g) => ({ value: g.goal, label: g.label[locale], description: g.hint[locale] }))}
          onValueChange={(v) => { const g = GOAL_TEMPLATES.find((x) => x.goal === v); if (g) p.onGoal(g.goal); }}
        />
        <SegmentedControl
          label={t("aspectLabel")} value={p.aspect} isDisabled={off} onValueChange={(v) => p.onAspect(v as Aspect)}
          options={ASPECT_CHOICES.map((a) => ({ value: a.value, label: a[locale] }))}
        />
        <SegmentedControl
          label={t("durationLabel")} value={String(p.seconds)} isDisabled={off} onValueChange={(v) => p.onSeconds(Number(v))}
          options={[...new Set([...DURATIONS, p.seconds])].sort((a, b) => a - b).map((s) => ({ value: String(s), label: t("seconds", { n: s }) }))}
        />
        <Input id="video-title" name="title" label={t("titleLabel")} hint={t("titleHint")} variant="secondary" value={p.title} isDisabled={off} onValueChange={p.onTitle} />
        <div className={FOOTER_END_CLASS_NAME}>
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
          {p.sources.length === 0 ? (
            <div className={STACK_SM_CLASS_NAME}>
              <Text weight="semibold">{t("sourcesHeading")}</Text>
              <Text size="xs" tone="muted">{t("sourcesHint")}</Text>
              <Text size="sm" tone="muted">{t("sourcesEmpty")}</Text>
            </div>
          ) : (
            <CheckboxGroup
              label={t("sourcesHeading")} description={t("sourcesHint")} variant="secondary" isDisabled={!p.canEdit} value={p.inputs.sourceIds}
              options={p.sources.map((s) => ({ value: s.id, label: s.topic ? `${s.topic} · ${s.title}` : s.title, description: <Text as="span" size="xs" tone="muted" overflow="clamp-2">{s.excerpt}</Text> }))}
              onValueChange={(ids) => p.onInputs({ ...p.inputs, sourceIds: ids })}
            />
          )}
          <Textarea label={t("notesLabel")} variant="secondary" description={t("notesHint")} rows={3} maxLength={600} value={p.inputs.notes} isDisabled={!p.canEdit} onValueChange={(v) => p.onInputs({ ...p.inputs, notes: v })} />
        </div>
      </SurfaceCard>

      <SurfaceCard label={t("mediaHeading")} fact={t("mediaHint")}>
        <div className={STACK_CLASS_NAME}>
          {p.media.length === 0 ? <Text size="sm" tone="muted">{t("mediaEmpty")}</Text> : (
            <List className={MEDIA_GRID_CLASS_NAME} label={t("mediaHeading")}>
              {p.media.filter((m) => m.kind === "image" || m.kind === "video").map((m) => {
                const on = p.inputs.media.includes(m.path);
                return (
                  <ListItem key={m.path} className={STACK_SM_CLASS_NAME}>
                    {m.url ? (
                      <MediaFrame aspect="square">
                        {m.kind === "image"
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.url} alt={m.name} />
                          : <video src={`${m.url}#t=0.5`} preload="metadata" muted playsInline aria-label={m.name} />}
                      </MediaFrame>
                    ) : null}
                    <Checkbox
                      label={m.name} variant="secondary" isSelected={on} isDisabled={!p.canEdit}
                      onSelectedChange={() => p.onInputs({ ...p.inputs, media: toggle(p.inputs.media, m.path) })}
                    />
                  </ListItem>
                );
              })}
            </List>
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
