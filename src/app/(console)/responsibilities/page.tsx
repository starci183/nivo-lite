import { PageContainer, SectionHeader, Button } from "@starci/grammar/common";
import { ResponsibilityBoard, type BoardInitialFilters } from "@/features/responsibilities/board";
import { stamp, toRowModels } from "@/features/responsibilities/format";
import { PAGE_CLASS_NAME } from "@/features/overview/classNames";
import { getLocale, getT } from "@/i18n/server";
import { responsibilities as dict } from "@/i18n/dict/responsibilities";
import { listAgents, listResponsibilities } from "@/lib/queries";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const STATUSES = ["all", "open", "waiting_approval", "done"] as const;
const DUES = ["any", "overdue", "today", "week", "none"] as const;

const pick = <T extends string>(value: string | string[] | undefined, allowed: ReadonlyArray<T>, fallback: T): T => {
  const single = Array.isArray(value) ? value[0] : value;
  return allowed.find((item) => item === single) ?? fallback;
};

/** Responsibility board: every responsibility by owner, filterable by status and due. */
const Page = async ({ searchParams }: PageProps) => {
  const params = await searchParams;
  const [responsibilities, agents] = await Promise.all([listResponsibilities(), listAgents()]);
  const [t, locale] = await Promise.all([getT(dict), getLocale()]);
  const now = new Date();
  const rows = toRowModels(responsibilities, agents, now, t);
  const initial: BoardInitialFilters = { status: pick(params.status, STATUSES, "all"), due: pick(params.due, DUES, "any") };
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <SectionHeader
          level={1}
          eyebrow={t("eyebrow")}
          title={t("pageTitle")}
          description={t("pageDescription", { time: stamp(now, locale) })}
          action={<Button variant="primary" href="/leads?new=1">{t("newLead")}</Button>}
        />
        <ResponsibilityBoard
          key={`${initial.status}-${initial.due}`}
          rows={rows}
          initial={initial}
          verifiedLabel={t("verified", { time: stamp(now, locale) })}
        />
      </div>
    </PageContainer>
  );
};

export default Page;
