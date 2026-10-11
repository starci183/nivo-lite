import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Heading, List, ListItem, PageContainer, SurfaceCard, Text } from "@starci/grammar/common";
import { ApplyForm } from "@/features/module-hiring/public/ApplyForm";
import { CARD_STACK, FACTS, FOOT_LINE, LIST_BLOCK, PRESERVE_BREAKS, PUBLIC_HEAD, PUBLIC_MAIN, PUBLIC_STACK } from "@/app/classNames";
import { hdb, loadPublicJob } from "@/lib/module-hiring-core";
import { EMPLOYMENT_LABEL, fmtPay } from "@/lib/module-hiring-shared";

type Props = { readonly params: Promise<{ ws: string; job: string }> };
export const dynamic = "force-dynamic";

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { ws, job } = await params;
  const pub = await loadPublicJob(hdb(), ws, job).catch(() => null);
  return pub ? { title: `${pub.job.title} - ${pub.company}`, description: `Ứng tuyển ${pub.job.title} tại ${pub.company}.` } : { title: "Tuyển dụng" };
};

/**
 * The public job page: the post, then the apply form. No login, no console chrome. Cards are Grammar `SurfaceCard`s,
 * the requirement lists `List`/`ListItem`. The facts are plain facts, so their Badges stay neutral (ACCENT-6 case-3).
 */
const JobPage = async ({ params }: Props) => {
  const { ws, job } = await params;
  const pub = await loadPublicJob(hdb(), ws, job).catch(() => null);
  if (!pub) notFound();
  const j = pub.job;
  const r = j.requirements;
  const list = (title: string, items: ReadonlyArray<string>) =>
    items.length ? (
      <div className={LIST_BLOCK}>
        <Text weight="semibold">{title}</Text>
        <List label={title}>{items.map((x) => <ListItem key={x}><Text>{x}</Text></ListItem>)}</List>
      </div>
    ) : null;
  return (
    <main className={PUBLIC_MAIN}>
      <PageContainer measure="reading">
        <div className={PUBLIC_STACK}>
          <div className={PUBLIC_HEAD}>
            <Text size="sm" tone="muted">{pub.company}</Text>
            <Heading level={1}>{j.title}</Heading>
            <div className={FACTS}>
              <Badge tone="neutral">{EMPLOYMENT_LABEL[j.employment_type]}</Badge>
              <Badge tone="neutral">{fmtPay(j.pay_min_vnd, j.pay_max_vnd, j.pay_unit)}</Badge>
              {j.location ? <Badge tone="neutral">{j.location}</Badge> : null}
              {j.schedule ? <Badge tone="neutral">{j.schedule}</Badge> : null}
            </div>
          </div>
          <SurfaceCard ariaLabel="Mô tả công việc">
            <div className={CARD_STACK}>
              {j.description ? <div className={PRESERVE_BREAKS}><Text size="sm">{j.description}</Text></div> : null}
              {list("Kỹ năng", r.skills)}
              {r.experience_years || r.experience_note ? <Text>{`Kinh nghiệm: ${r.experience_years ? `từ ${r.experience_years} năm` : ""}${r.experience_note ? ` ${r.experience_note}` : ""}`.trim()}</Text> : null}
              {list("Lịch làm việc", r.availability)}
              {list("Yêu cầu", r.must_have)}
              {list("Điểm cộng", r.nice_to_have)}
            </div>
          </SurfaceCard>
          {pub.open ? (
            <SurfaceCard ariaLabel="Nộp hồ sơ">
              <div className={CARD_STACK}>
                <Heading level={2}>Ứng tuyển</Heading>
                <ApplyForm ws={ws} job={job} questions={j.questions} availability={r.availability} consentText={pub.consentText} />
              </div>
            </SurfaceCard>
          ) : (
            <SurfaceCard ariaLabel="Tin đã đóng">
              <div className={CARD_STACK}>
                <Heading level={2}>Tin này hiện không nhận hồ sơ</Heading>
                <Text tone="muted">Cảm ơn bạn đã quan tâm. Hãy theo dõi các tin tuyển dụng khác của {pub.company}.</Text>
              </div>
            </SurfaceCard>
          )}
          <div className={FOOT_LINE}><Text size="xs">Trang tuyển dụng của {pub.company}, vận hành bởi NIVO.</Text></div>
        </div>
      </PageContainer>
    </main>
  );
};

export default JobPage;
