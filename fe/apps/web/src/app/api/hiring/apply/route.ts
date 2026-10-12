import { after, NextResponse, type NextRequest } from "next/server";
import { HiringError, CV_MAX_BYTES, hashIp, hdb, loadPublicJob, rateLimited, submitApplication, type Db } from "@/lib/module-hiring-core";
import { drainHiring, hiringCtx, startScreening } from "@/lib/module-hiring-flow";
import type { JobRow } from "@/lib/module-hiring-shared";

/**
 * POST /api/hiring/apply (multipart, no login): a candidate applies on the public page /j/<workspace>/<job>.
 * Fields: ws, job (slugs), name, phone, email, availability, consent=1, q_<question id>=answer, cv (file), website (honeypot: must be empty).
 * Limits: CV up to 5 MB and only PDF / Word / JPG / PNG (checked on the file's own bytes), 8 applications per hour per address, consent required.
 * The application is stored with its consent record; screening is queued and runs after the response.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const reply = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
const ipOf = (r: NextRequest): string => r.headers.get("x-nf-client-connection-ip") ?? r.headers.get("x-real-ip") ?? r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
const text = (v: FormDataEntryValue | null, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: NextRequest) {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > CV_MAX_BYTES + 512 * 1024) return reply(413, { ok: false, message: "File CV lớn quá 5 MB. Hãy nén hoặc gửi bản nhẹ hơn." });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, { ok: false, message: "Biểu mẫu chưa đúng, vui lòng thử lại." });
  }
  // honeypot: a person never fills it; answer like a success so a bot learns nothing
  if (text(form.get("website"), 200)) return reply(200, { ok: true, message: "Đã nhận hồ sơ của bạn. Cảm ơn bạn!" });
  const db: Db = hdb();
  const ipHash = hashIp(ipOf(request));
  try {
    const pub = await loadPublicJob(db, text(form.get("ws"), 80), text(form.get("job"), 100));
    if (!pub) return reply(404, { ok: false, message: "Không tìm thấy tin tuyển dụng này." });
    if (await rateLimited(db, ipHash, pub.workspaceId)) return reply(429, { ok: false, message: "Bạn gửi hơi nhiều lần trong một giờ. Vui lòng thử lại sau." });
    if (!pub.open) return reply(409, { ok: false, message: "Tin tuyển dụng này hiện không nhận hồ sơ." });
    const job = (await db.from("hiring_jobs").select("*").eq("id", pub.job.id).single()).data as JobRow;
    const file = form.get("cv");
    const cv = file instanceof File && file.size > 0 ? { bytes: Buffer.from(await file.arrayBuffer()), name: file.name || "cv" } : null;
    const answers = job.questions.map((q) => ({ question_id: q.id, answer: text(form.get(`q_${q.id}`), 1000) }));
    const r = await submitApplication(db, {
      ws: pub.workspaceId, job, source: "page", name: text(form.get("name"), 120), phone: text(form.get("phone"), 30), email: text(form.get("email"), 254),
      availability: text(form.get("availability"), 300), answers, consent: form.get("consent") === "1" || form.get("consent") === "on", consentText: pub.consentText, ipHash, cv,
    });
    if (!r.duplicate) {
      await startScreening(pub.workspaceId, r.candidate.id);
      after(async () => {
        try {
          await drainHiring(pub.workspaceId, 2);
        } catch (e) {
          console.error("hiring screening failed:", e instanceof Error ? e.message : e);
        }
      });
    }
    return reply(200, { ok: true, duplicate: r.duplicate, message: r.duplicate ? "Bạn đã nộp hồ sơ cho vị trí này rồi. Doanh nghiệp sẽ liên hệ với bạn." : "Đã nhận hồ sơ của bạn. Doanh nghiệp sẽ liên hệ nếu hồ sơ phù hợp. Cảm ơn bạn!" });
  } catch (e) {
    if (e instanceof HiringError) return reply(422, { ok: false, message: e.message });
    console.error("hiring apply failed:", e instanceof Error ? e.message : e);
    return reply(500, { ok: false, message: "Có lỗi khi nộp hồ sơ, vui lòng thử lại sau ít phút." });
  }
}
