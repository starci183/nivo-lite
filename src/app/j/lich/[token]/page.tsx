import type { Metadata } from "next";
import { Alert, Heading, Text } from "@starci/grammar/common";
import { Respond } from "@/features/module-hiring/public/Respond";
import { CANVAS_CLASS_NAME, CARD_CLASS_NAME, COLUMN_CLASS_NAME, FOOT_CLASS_NAME } from "@/features/module-hiring/public/classNames";
import { hdb } from "@/lib/module-hiring-core";
import { loadInterviewByToken } from "@/lib/module-hiring-flow";
import { fmtVnDateTime } from "@/lib/module-hiring-shared";

type Props = { readonly params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chọn giờ phỏng vấn", robots: { index: false, follow: false } };

/** The candidate's own link: choose one of the proposed interview times. The 32-hex token is the secret. */
const SlotPage = async ({ params }: Props) => {
  const { token } = await params;
  const hit = await loadInterviewByToken(hdb(), token).catch(() => null);
  const frame = (body: React.ReactNode) => (
    <main className={CANVAS_CLASS_NAME}>
      <div className={COLUMN_CLASS_NAME}>
        {body}
        <div className={FOOT_CLASS_NAME}><Text size="xs" tone="muted">Vận hành bởi NIVO.</Text></div>
      </div>
    </main>
  );
  if (!hit) return frame(<Alert tone="cautionary" title="Đường dẫn này không còn hiệu lực" description="Vui lòng liên hệ doanh nghiệp để được hỗ trợ." />);
  const { iv, cand, job, shop } = hit;
  const where = `${iv.mode === "online" ? "Online" : "Trực tiếp"}${iv.location ? `: ${iv.location}` : ""}`;
  return frame(
    <section className={CARD_CLASS_NAME} aria-label="Chọn giờ phỏng vấn">
      <Text size="sm" tone="muted">{shop}</Text>
      <Heading level={1} scale="standard">{`Chào ${cand.name}, mời bạn phỏng vấn vị trí ${job.title}`}</Heading>
      <Text tone="muted">{`${where}. Khoảng ${iv.duration_min} phút${iv.interviewer_name ? `, người phỏng vấn: ${iv.interviewer_name}` : ""}.`}</Text>
      {iv.status === "confirmed" && iv.slot_start ? (
        <Alert tone="affirmative" title={`Lịch đã được xác nhận: ${fmtVnDateTime(iv.slot_start)}`} description="Bạn sẽ nhận được nhắc trước buổi phỏng vấn." />
      ) : iv.status === "proposed" ? (
        <>
          <Text weight="medium">Chọn một giờ phù hợp với bạn:</Text>
          <Respond kind="slot" token={token} slots={iv.proposed_slots.map((s) => ({ start: s.start, label: fmtVnDateTime(s.start) }))} />
        </>
      ) : (
        <Alert tone="cautionary" title="Lịch này đã đóng" description="Vui lòng liên hệ doanh nghiệp nếu cần xếp lại." />
      )}
    </section>,
  );
};

export default SlotPage;
