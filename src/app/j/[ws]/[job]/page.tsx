import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Heading, Text } from "@starci/grammar/common";
import { ApplyForm } from "@/features/module-hiring/public/ApplyForm";
import { CANVAS_CLASS_NAME, CARD_CLASS_NAME, COLUMN_CLASS_NAME, FACTS_CLASS_NAME, FOOT_CLASS_NAME, PRE_CLASS_NAME } from "@/features/module-hiring/public/classNames";
import { hdb, loadPublicJob } from "@/lib/module-hiring-core";
import { EMPLOYMENT_LABEL, fmtPay } from "@/lib/module-hiring-shared";

type Props = { readonly params: Promise<{ ws: string; job: string }> };
export const dynamic = "force-dynamic";

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { ws, job } = await params;
  const pub = await loadPublicJob(hdb(), ws, job).catch(() => null);
  return pub ? { title: `${pub.job.title} - ${pub.company}`, description: `Ứng tuyển ${pub.job.title} tại ${pub.company}.` } : { title: "Tuyển dụng" };
};

/** The public job page: the post, then the apply form. No login, no console chrome. */
const JobPage = async ({ params }: Props) => {
  const { ws, job } = await params;
  const pub = await loadPublicJob(hdb(), ws, job).catch(() => null);
  if (!pub) notFound();
  const j = pub.job;
  const r = j.requirements;
  const list = (title: string, items: ReadonlyArray<string>) =>
    items.length ? (
      <div>
        <Text weight="semibold">{title}</Text>
        <ul className="m-0 list-disc pl-5">{items.map((x) => <li key={x}><Text as="span">{x}</Text></li>)}</ul>
      </div>
    ) : null;
  return (
    <main className={CANVAS_CLASS_NAME}>
      <div className={COLUMN_CLASS_NAME}>
        <header className="flex flex-col gap-2">
          <Text size="sm" tone="muted">{pub.company}</Text>
          <Heading level={1} scale="standard">{j.title}</Heading>
          <div className={FACTS_CLASS_NAME}>
            <Badge tone="accent">{EMPLOYMENT_LABEL[j.employment_type]}</Badge>
            <Badge tone="neutral">{fmtPay(j.pay_min_vnd, j.pay_max_vnd, j.pay_unit)}</Badge>
            {j.location ? <Badge tone="neutral">{j.location}</Badge> : null}
            {j.schedule ? <Badge tone="neutral">{j.schedule}</Badge> : null}
          </div>
        </header>
        <section className={CARD_CLASS_NAME} aria-label="Mô tả công việc">
          {j.description ? <p className={PRE_CLASS_NAME}>{j.description}</p> : null}
          {list("Kỹ năng", r.skills)}
          {r.experience_years || r.experience_note ? <Text>{`Kinh nghiệm: ${r.experience_years ? `từ ${r.experience_years} năm` : ""}${r.experience_note ? ` ${r.experience_note}` : ""}`.trim()}</Text> : null}
          {list("Lịch làm việc", r.availability)}
          {list("Yêu cầu", r.must_have)}
          {list("Điểm cộng", r.nice_to_have)}
        </section>
        {pub.open ? (
          <section className={CARD_CLASS_NAME} aria-label="Nộp hồ sơ">
            <Heading level={2}>Ứng tuyển</Heading>
            <ApplyForm ws={ws} job={job} questions={j.questions} availability={r.availability} consentText={pub.consentText} />
          </section>
        ) : (
          <section className={CARD_CLASS_NAME} aria-label="Tin đã đóng">
            <Heading level={2}>Tin này hiện không nhận hồ sơ</Heading>
            <Text tone="muted">Cảm ơn bạn đã quan tâm. Hãy theo dõi các tin tuyển dụng khác của {pub.company}.</Text>
          </section>
        )}
        <div className={FOOT_CLASS_NAME}><Text size="xs" tone="muted">Trang tuyển dụng của {pub.company}, vận hành bởi NIVO.</Text></div>
      </div>
    </main>
  );
};

export default JobPage;
