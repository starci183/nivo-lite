"use client";

import { useMemo, useState } from "react";
import { Badge, Button, SearchField, Select, Tabs, Text, TextAction } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { responsibilities } from "@/i18n/dict/responsibilities";
import { OwnerGroups } from "./component";
import {
  BOARD_CLASS_NAME,
  FILTERS_CLASS_NAME,
  LIST_HEAD_CLASS_NAME,
  LIST_TITLE_CLASS_NAME,
  SEARCH_CLASS_NAME,
  SORT_CLASS_NAME,
  TOOLBAR_CLASS_NAME,
  TOOLBAR_END_CLASS_NAME,
} from "./classNames";
import { groupByOwner, statusLabel, type ResponsibilityRowModel } from "./format";

type StatusKey = "all" | ResponsibilityRowModel["status"];
type DueKey = "any" | "overdue" | "today" | "week" | "none";
type SortKey = "due" | "newest";

/** The filters a link can preselect. */
export type BoardInitialFilters = { status: StatusKey; due: DueKey };

/** Props for {@link ResponsibilityBoard}. */
export type ResponsibilityBoardProps = {
  rows: Array<ResponsibilityRowModel>;
  initial: BoardInitialFilters;
  verifiedLabel: string;
};

const ALL = "all";
const ANY = "any";

const STAGE_KEYS = { new: "stageNew", qualified: "stageQualified", proposal: "stageProposal", won: "stageWon", lost: "stageLost" } as const;

const matchesDue = (row: ResponsibilityRowModel, due: DueKey): boolean => {
  if (due === "overdue") return row.isOverdue;
  if (due === "today") return row.isDueToday;
  if (due === "week") return row.isDueThisWeek;
  if (due === "none") return row.dueAt === null && row.status !== "done";
  return true;
};

const byDue = (a: ResponsibilityRowModel, b: ResponsibilityRowModel): number => {
  if (a.dueAt === b.dueAt) return 0;
  if (a.dueAt === null) return 1;
  if (b.dueAt === null) return -1;
  return a.dueAt.localeCompare(b.dueAt);
};

const byNewest = (a: ResponsibilityRowModel, b: ResponsibilityRowModel): number => b.createdAt.localeCompare(a.createdAt);

/** The full board: filter cards, status tabs with counts, search and sort over the same owner-grouped rows. */
export const ResponsibilityBoard = (props: ResponsibilityBoardProps) => {
  const t = useT(responsibilities);
  const dueOptions: ReadonlyArray<{ id: DueKey; label: string }> = [
    { id: "any", label: t("anyTime") },
    { id: "overdue", label: t("dueOverdue") },
    { id: "today", label: t("dueToday") },
    { id: "week", label: t("dueWeek") },
    { id: "none", label: t("noDue") },
  ];
  const sortOptions: ReadonlyArray<{ id: SortKey; label: string }> = [
    { id: "due", label: t("sortDue") },
    { id: "newest", label: t("sortNewest") },
  ];
  const emptyText: Record<StatusKey, { message: string; description: string }> = {
    all: { message: t("emptyAll"), description: t("emptyAllDesc") },
    open: { message: t("emptyOpen"), description: t("emptyAllDesc") },
    waiting_approval: { message: t("emptyWaiting"), description: t("emptyWaitingDesc") },
    done: { message: t("emptyDone"), description: t("emptyDoneDesc") },
  };
  const [status, setStatus] = useState<StatusKey>(props.initial.status);
  const [due, setDue] = useState<DueKey>(props.initial.due);
  const [owner, setOwner] = useState<string>(ALL);
  const [stage, setStage] = useState<string>(ANY);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [showFilters, setShowFilters] = useState(false);

  const owners = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of props.rows) seen.set(row.ownerKey, row.ownerName);
    return [{ id: ALL, label: t("allOwners") }, ...[...seen].map(([id, label]) => ({ id, label }))];
  }, [props.rows, t]);

  const stages = useMemo(() => {
    const present = new Set(props.rows.map((row) => row.stage));
    return [
      { id: ANY, label: t("anyStage") },
      ...(Object.keys(STAGE_KEYS) as Array<keyof typeof STAGE_KEYS>)
        .filter((key) => present.has(key))
        .map((key) => ({ id: key, label: t(STAGE_KEYS[key]) })),
    ];
  }, [props.rows, t]);

  const isFiltered = status !== ALL || due !== ANY || owner !== ALL || stage !== ANY || query.trim() !== "";

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.rows.filter(
      (row) =>
        (owner === ALL || row.ownerKey === owner) &&
        (stage === ANY || row.stage === stage) &&
        matchesDue(row, due) &&
        (q === "" || `${row.title} ${row.customer} ${row.nextAction} ${row.ownerName}`.toLowerCase().includes(q)),
    );
  }, [props.rows, owner, stage, due, query]);

  const counts = useMemo(() => {
    const byStatus = { all: scoped.length, open: 0, waiting_approval: 0, done: 0 };
    for (const row of scoped) byStatus[row.status] += 1;
    return byStatus;
  }, [scoped]);

  const visible = useMemo(
    () => scoped.filter((row) => status === ALL || row.status === status).sort(sort === "due" ? byDue : byNewest),
    [scoped, status, sort],
  );
  const groups = useMemo(() => groupByOwner(visible), [visible]);

  const clear = () => {
    setStatus(ALL);
    setDue(ANY);
    setOwner(ALL);
    setStage(ANY);
    setQuery("");
  };

  const empty = isFiltered
    ? { message: t("emptyFiltered"), description: t("emptyFilteredDesc") }
    : emptyText[status];

  return (
    <div className={BOARD_CLASS_NAME}>
      {showFilters ? (
      <div className={FILTERS_CLASS_NAME}>
        <Select label={t("filterOwner")} options={owners} value={owner} onValueChange={(value) => { setOwner(value ?? ALL); }} />
        <Select
            label={t("filterDue")}
            options={dueOptions}
            value={due}
            onValueChange={(value) => {
              setDue((dueOptions.find((option) => option.id === value)?.id) ?? "any");
            }}
          />
        <Select label={t("filterStage")} options={stages} value={stage} onValueChange={(value) => { setStage(value ?? ANY); }} />
        <div>
          <TextAction onPress={clear} isDisabled={!isFiltered}>{t("clearFilters")}</TextAction>
        </div>
      </div>
      ) : null}

      <div className={TOOLBAR_CLASS_NAME}>
        <Tabs
          label={t("tabsLabel")}
          selectedKey={status}
          inset="none"
          labelVisibility="always"
          items={(["all", "open", "waiting_approval", "done"] as const).map((id) => ({
            id,
            label: `${id === "all" ? t("tabAll") : statusLabel(t, id)} (${counts[id]})`,
          }))}
          onSelect={(key) => {
            if (key === "all" || key === "open" || key === "waiting_approval" || key === "done") setStatus(key);
          }}
        />
        <div className={TOOLBAR_END_CLASS_NAME}>
          <div className={SEARCH_CLASS_NAME}>
            <SearchField
              label={t("searchLabel")}
              isLabelHidden
              placeholder={t("searchPlaceholder")}
              value={query}
              onValueChange={setQuery}
              onClear={() => { setQuery(""); }}
            />
          </div>
          <Button variant="ghost" onPress={() => setShowFilters((open) => !open)}>{t("filters")}</Button>
          <div className={SORT_CLASS_NAME}>
            <Select
              label={t("sortLabel")} isLabelHidden
              options={sortOptions}
              value={sort}
              onValueChange={(value) => { setSort(value === "newest" ? "newest" : "due"); }}
            />
          </div>
        </div>
      </div>

      <div className={LIST_HEAD_CLASS_NAME}>
        <div className={LIST_TITLE_CLASS_NAME}>
          <Text weight="semibold">{t("byOwner")}</Text>
          <Badge tone="neutral">{String(visible.length)}</Badge>
        </div>
        <Text size="xs" tone="muted">{props.verifiedLabel}</Text>
      </div>

      <OwnerGroups groups={groups} emptyMessage={empty.message} emptyDescription={empty.description} />
    </div>
  );
};
