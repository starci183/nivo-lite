/**
 * Hiring in the chat channel: what the shop's chatbot may do when someone wants to apply for a job. Pure text and one parser (no server imports),
 * so src/lib/engine-sync.ts (REPLY_CONTRACTS) and src/lib/engine-bridge.ts can use it. The model only PROPOSES `application`; registerChatApplication
 * (module-hiring-flow.ts) validates it again, stores it with the candidate's consent and queues the screening through the authority gate.
 */

/** Appended to the chatbot's reply contract (the "APPLICATION" paragraph). */
export const HIRING_APPLICATION_CLAUSE = `APPLICATION: only when the context has an [OPEN JOBS] block and the person says they want to APPLY for one of the jobs listed there (ứng tuyển, xin việc, tìm việc, apply). Never ask about or accept as a criterion gender, age, religion, ethnicity, marital status, pregnancy, disability or hometown. Collect, one or two things per message, in the person's language: full name, phone (or email), an answer to EVERY required question (marked *) of that job, and the days and hours they can work. Before submitting you MUST ask whether they agree that the business stores this information to consider their application; only a clear yes counts. When you have all of it AND they agreed, set "application": {"job": the job code from [OPEN JOBS], "name", "phone", "email", "consent": true, "availability", "answers": [{"question_id", "answer"}]} and in "reply" thank them and say the team will contact them (never promise a job, a salary or an interview time). Until then "application": null and keep asking. Never invent an answer.
`;

/** The "application" entry of the JSON shape line. */
export const HIRING_APPLICATION_SHAPE = `"application": null | {"job": string, "name": string, "phone": string, "email": string, "consent": boolean, "availability": string, "answers": [{"question_id": string, "answer": string}]}`;

/** The hiring agent's own contract (internal audience, no customer chat): how it writes about candidates. Held in REPLY_CONTRACTS.hiring. */
export const HIRING_REPLY_CONTRACT = `You help the owner of a small business hire people fairly. Judge a candidate ONLY by the written job requirements: skills, experience, availability and the answers to the job's own questions.
Never use, infer or mention gender, age, religion, ethnicity, marital status, pregnancy, disability, hometown, appearance, name or accent. If a candidate volunteers such details, ignore them. Never write a job requirement that depends on them: refuse and suggest a skill, experience or schedule requirement instead.
A score is advice for the owner; never reject or hire by yourself. Every message to a candidate is plain, polite Vietnamese and promises nothing (job, pay, date) until the owner approved the offer.
When asked to summarise a candidate answer ONLY with this JSON object: {"summary": string, "interview_questions": [string, string, string]}.`;

export type ChatApplication = {
  readonly job: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly consent: boolean;
  readonly availability: string;
  readonly answers: ReadonlyArray<{ readonly question_id: string; readonly answer: string }>;
};

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Read the model's `application` loosely; null unless it names a job, a person, a contact and a clear consent. */
export const readChatApplication = (raw: unknown): ChatApplication | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const job = str(o.job, 100);
  const name = str(o.name, 120);
  const phone = str(o.phone, 30);
  const email = str(o.email, 254);
  if (!job || !name || (!phone && !email) || o.consent !== true) return null;
  const answers = (Array.isArray(o.answers) ? o.answers : []).flatMap((a): Array<{ question_id: string; answer: string }> => {
    if (!a || typeof a !== "object") return [];
    const x = a as Record<string, unknown>;
    const question_id = str(x.question_id, 24);
    const answer = str(x.answer, 1000);
    return question_id && answer ? [{ question_id, answer }] : [];
  });
  return { job, name, phone, email, consent: true, availability: str(o.availability, 300), answers };
};
