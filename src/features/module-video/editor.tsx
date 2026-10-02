"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Stepper } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { video } from "@/i18n/dict/video";
import { estimateScriptSeconds, templateOf, type Brand, type Goal, type MediaItem, type ProjectInputs, type ProjectView, type ScriptScene, type SourceChoice } from "@/lib/module-video-shared";
import type { Aspect } from "@/lib/video/spec";
import { approveVideoAction, createVideo, markVideoPublished, pollVideo, refreshMedia, renderVideo, scriptVideo, shareVideo, updateVideo } from "./actions";
import { PAGE_CLASS_NAME, ROW_CLASS_NAME } from "./classNames";
import { GoalStep, InputsStep } from "./steps-setup";
import { PreviewStep, ResultStep, ScriptStep } from "./steps-make";
import { uploadMedia } from "./upload";

export type StepId = "goal" | "inputs" | "script" | "preview" | "result";
const STEPS: ReadonlyArray<StepId> = ["goal", "inputs", "script", "preview", "result"];

/** Props for {@link Editor}. */
export type EditorProps = {
  /** The project to continue, or null for a new one (created when the first step is saved). */
  readonly project: ProjectView | null;
  readonly brand: Brand;
  readonly sources: ReadonlyArray<SourceChoice>;
  readonly media: ReadonlyArray<MediaItem>;
  readonly canEdit: boolean;
  readonly onMedia: (media: ReadonlyArray<MediaItem>) => void;
  readonly onBrand: (brand: Brand, media: ReadonlyArray<MediaItem>) => void;
  readonly onProject: (project: ProjectView) => void;
  readonly onClose: () => void;
};

/** Where an existing project continues: what is next to do with it. */
const stepFor = (p: ProjectView | null): StepId => {
  if (!p) return "goal";
  if (p.status === "ready" || p.status === "approved" || p.status === "published") return "result";
  if (p.status === "rendering") return "preview";
  if (p.status === "scripting" || p.script.length > 0) return "script";
  return "inputs";
};

/** The wizard: goal, material, script, preview, result. Every step saves the project on the server, so leaving and coming back loses nothing. */
export const Editor = ({ project: initial, brand, sources, media, canEdit, onMedia, onBrand, onProject, onClose }: EditorProps) => {
  const t = useT(video);
  const locale = useLocale();
  const [project, setProject] = useState<ProjectView | null>(initial);
  const [step, setStep] = useState<StepId>(stepFor(initial));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Step 1 form
  const first = initial ? templateOf(initial.goal) : templateOf("service");
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? first.goal);
  const [aspect, setAspect] = useState<Aspect>(initial?.aspect ?? first.default_aspect);
  const [seconds, setSeconds] = useState<number>(initial?.targetSeconds ?? first.default_seconds);
  const [title, setTitle] = useState<string>(initial?.title ?? "");
  // Step 2 form
  const [inputs, setInputs] = useState<ProjectInputs>(initial?.inputs ?? { sourceIds: [], notes: "", media: [], auto: false });
  // Step 3 form (local until saved)
  const [scenes, setScenes] = useState<ReadonlyArray<ScriptScene>>(initial?.script ?? []);
  const [dirty, setDirty] = useState(false);

  const accept = useCallback((p: ProjectView) => {
    setProject(p);
    onProject(p);
  }, [onProject]);

  const fail = (e: string) => { setError(t("actionFailed", { error: e })); setBusy(null); };
  const run = async (name: string, fn: () => Promise<boolean>) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  /* ------------------------------------------------ polling while the server works */
  const status = project?.status ?? null;
  const projectId = project?.id ?? null;
  const lastStatus = useRef(status);
  useEffect(() => {
    if (!projectId || (status !== "scripting" && status !== "rendering")) return;
    let stop = false;
    const tick = async () => {
      const r = await pollVideo(projectId);
      if (stop || !r.ok) return;
      accept(r.data);
    };
    const id = window.setInterval(() => { void tick(); }, 2000);
    return () => { stop = true; window.clearInterval(id); };
  }, [projectId, status, accept]);

  // A finished script replaces the local scenes; a finished render moves on to the result.
  useEffect(() => {
    if (lastStatus.current === "scripting" && status !== "scripting" && project) {
      setScenes(project.script);
      setDirty(false);
      if (project.lastError) setError(project.lastError);
    }
    if (lastStatus.current === "rendering" && status === "ready") setStep("result");
    if (lastStatus.current === "rendering" && status === "draft" && project?.lastError) setError(project.lastError);
    lastStatus.current = status;
  }, [status, project]);

  /* ------------------------------------------------ commands */
  const saveGoal = () => run("goal", async () => {
    const targetSeconds = seconds;
    const r = project ? await updateVideo(project.id, { goal, aspect, targetSeconds, title }) : await createVideo({ goal, aspect, targetSeconds, title, inputs });
    if (!r.ok) { fail(r.error); return false; }
    accept(r.data);
    setTitle(r.data.title);
    setStep("inputs");
    return true;
  });

  const saveInputs = (then: StepId | null) => run("inputs", async () => {
    if (!project) return false;
    const r = await updateVideo(project.id, { inputs });
    if (!r.ok) { fail(r.error); return false; }
    accept(r.data);
    if (then) setStep(then);
    return true;
  });

  const upload = (files: ReadonlyArray<File>) => run("upload", async () => {
    const r = await uploadMedia(files, (name) => setNotice(t("uploading", { name })));
    setNotice(null);
    if (r.errors.length) setError(r.errors.map((e) => t("uploadFailed", { name: e.name, error: e.error })).join(" "));
    const m = await refreshMedia();
    if (m.ok) onMedia(m.data);
    if (r.paths.length) setInputs((i) => ({ ...i, media: [...i.media, ...r.paths] }));
    return true;
  });

  const write = () => run("script", async () => {
    if (!project) return false;
    const saved = await updateVideo(project.id, { inputs });
    if (!saved.ok) { fail(saved.error); return false; }
    const r = await scriptVideo(project.id);
    if (!r.ok) { fail(r.error); return false; }
    accept(r.data);
    return true;
  });

  const saveScript = (then: StepId | null) => run("saveScript", async () => {
    if (!project) return false;
    if (dirty) {
      const r = await updateVideo(project.id, { script: scenes });
      if (!r.ok) { fail(r.error); return false; }
      accept(r.data);
      setDirty(false);
    }
    if (then) setStep(then);
    return true;
  });

  const render = () => run("render", async () => {
    if (!project) return false;
    if (dirty) {
      const s = await updateVideo(project.id, { script: scenes });
      if (!s.ok) { fail(s.error); return false; }
      setDirty(false);
    }
    const r = await renderVideo(project.id);
    if (!r.ok) { fail(r.error); return false; }
    accept(r.data);
    return true;
  });

  const approve = () => run("approve", async () => {
    if (!project) return false;
    const r = await approveVideoAction(project.id);
    if (!r.ok) { fail(r.error); return false; }
    accept(r.data);
    return true;
  });

  const share = () => run("share", async () => {
    if (!project) return false;
    const r = await shareVideo(project.id);
    if (!r.ok) { fail(r.error); return false; }
    setNotice(r.data.telegram ? t("sharedTelegram") : t("shared"));
    return true;
  });

  const markPosted = () => run("posted", async () => {
    if (!project) return false;
    const r = await markVideoPublished(project.id);
    if (!r.ok) { fail(r.error); return false; }
    accept(r.data);
    setNotice(t("postedNote"));
    return true;
  });

  const stepperSteps = useMemo(() => STEPS.map((id) => ({ id, label: t(`step_${id}` as "step_goal"), isDisabled: id !== "goal" && !project })), [t, project]);
  const goStep = (id: string) => {
    if (!project && id !== "goal") return;
    setError(null);
    setNotice(null);
    setStep(id as StepId);
  };

  return (
    <div className={PAGE_CLASS_NAME}>
      <div className={ROW_CLASS_NAME}>
        <Button variant="ghost" size="sm" onPress={onClose}>{t("toLibrary")}</Button>
      </div>
      <Stepper label={t("stepperLabel")} steps={stepperSteps} currentStepId={step} onStepSelect={goStep} />
      {error ? <Alert tone="negative" title={error} dismissLabel={t("back")} onDismiss={() => setError(null)} /> : null}
      {notice ? <Alert tone="informative" title={notice} /> : null}
      {!canEdit ? <Alert tone="cautionary" title={t("viewOnly")} /> : null}

      {step === "goal" ? (
        <GoalStep
          goal={goal} aspect={aspect} seconds={seconds} title={title} canEdit={canEdit} busy={busy === "goal"} locked={status === "scripting" || status === "rendering"}
          onGoal={(g) => { setGoal(g); setSeconds(templateOf(g).default_seconds); setAspect(templateOf(g).default_aspect); }}
          onAspect={setAspect} onSeconds={setSeconds} onTitle={setTitle} onNext={() => { void saveGoal(); }}
        />
      ) : null}
      {step === "inputs" ? (
        <InputsStep
          inputs={inputs} sources={sources} media={media} brand={brand} canEdit={canEdit} busy={busy === "inputs" || busy === "upload"}
          onInputs={setInputs} onUpload={(f) => { void upload(f); }} onBrand={onBrand}
          onBack={() => { void saveInputs("goal"); }} onNext={() => { void saveInputs("script"); }}
        />
      ) : null}
      {step === "script" && project ? (
        <ScriptStep
          project={project} scenes={scenes} media={media} canEdit={canEdit} dirty={dirty} writing={status === "scripting" || busy === "script"} saving={busy === "saveScript"}
          onScenes={(s) => { setScenes(s); setDirty(true); }} onWrite={() => { void write(); }}
          onBack={() => { void saveScript("inputs"); }} onNext={() => { void saveScript("preview"); }}
        />
      ) : null}
      {step === "preview" && project ? (
        <PreviewStep
          project={project} scenes={scenes} media={media} brand={brand} canEdit={canEdit} rendering={status === "rendering" || busy === "render"}
          onBack={() => setStep("script")} onRender={() => { void render(); }}
        />
      ) : null}
      {step === "result" && project ? (
        <ResultStep
          project={project} canEdit={canEdit} busy={busy} locale={locale} seconds={estimateScriptSeconds(scenes)}
          onApprove={() => { void approve(); }} onShare={() => { void share(); }} onPosted={() => { void markPosted(); }} onEdit={() => setStep("script")} onRerender={() => setStep("preview")}
        />
      ) : null}
    </div>
  );
};
