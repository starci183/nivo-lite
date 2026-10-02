import type { Metadata } from "next";
import { Alert, Heading, Text } from "@starci/grammar/common";
import { Respond } from "@/features/module-hiring/public/Respond";
import { CANVAS_CLASS_NAME, CARD_CLASS_NAME, COLUMN_CLASS_NAME, FOOT_CLASS_NAME, PRE_CLASS_NAME } from "@/features/module-hiring/public/classNames";
import { hdb } from "@/lib/module-hiring-core";
import { loadOfferByToken } from "@/lib/module-hiring-flow";
import { fmtVnDate } from "@/lib/module-hiring-shared";

type Props = { readonly params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thư mời nhận việc", robots: { index: false, follow: false } };

/** The candidate's own link: read the offer and accept or decline. The 32-hex token is the secret. */
const OfferPage = async ({ params }: Props) => {
  const { token } = await params;
  const hit = await loadOfferByToken(hdb(), token).catch(() => null);
  const frame = (body: React.ReactNode) => (
    <main className={CANVAS_CLASS_NAME}>
      <div className={COLUMN_CLASS_NAME}>
        {body}
        <div className={FOOT_CLASS_NAME}><Text size="xs" tone="muted">Vận hành bởi NIVO.</Text></div>
      </div>
    </main>
  );
  if (!hit) return frame(<Alert tone="cautionary" title="Đường dẫn này không còn hiệu lực" description="Vui lòng liên hệ doanh nghiệp để được hỗ trợ." />);
  const { offer, cand, job, shop } = hit;
  const expired = offer.status === "expired" || (offer.status === "sent" && offer.expires_at !== null && Date.parse(offer.expires_at) < Date.now());
  return frame(
    <section className={CARD_CLASS_NAME} aria-label="Thư mời nhận việc">
      <Text size="sm" tone="muted">{shop}</Text>
      <Heading level={1} scale="standard">{`Thư mời nhận việc: ${offer.terms.title || job.title}`}</Heading>
      <p className={PRE_CLASS_NAME}>{offer.draft}</p>
      {offer.expires_at ? <Text size="sm" tone="muted">{`Thư có hiệu lực đến ${fmtVnDate(offer.expires_at)}.`}</Text> : null}
      {offer.status === "accepted" ? <Alert tone="affirmative" title={`${cand.name} đã đồng ý thư mời này`} description="Doanh nghiệp sẽ liên hệ về ngày đi làm." />
        : offer.status === "declined" ? <Alert tone="informative" title="Bạn đã từ chối thư mời này" />
        : expired ? <Alert tone="cautionary" title="Thư mời đã hết hạn" description="Vui lòng liên hệ doanh nghiệp nếu bạn vẫn muốn nhận việc." />
        : <Respond kind="offer" token={token} />}
    </section>,
  );
};

export default OfferPage;
