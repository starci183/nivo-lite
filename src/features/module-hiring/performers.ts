import "server-only";
import type { Performer } from "@/lib/engine";
import {
  cancelOfferOnReject, performInterview, performOffer, performScreening, prepareOffer, prepareScreening,
} from "@/lib/module-hiring-flow";

/**
 * The functions are called lazily (arrow wrappers): this file is imported by module-performers.ts, which engine.ts imports, which module-hiring-flow.ts imports.
 * What happens once the gate lets a hiring action through (automatically, or after the owner approved it):
 *   screen_candidate    auto  prepare = checklist + one OpenClaw summary; perform = store the advisory score (never rejects)
 *   schedule_interview  auto  preset by requestInterview; perform = propose slots from the interviewer's availability and send them to the candidate
 *   send_offer          ask   prepare = OpenClaw drafts the letter; perform (after approval) = send it with the candidate's reply link
 */
export const screenCandidate: Performer = {
  prepare: (c, item) => prepareScreening(c, item),
  perform: (c, item, p, by) => performScreening(c, item, p, by),
};

export const scheduleInterview: Performer = {
  prepare: async (_c, item) => ({ proposal: item.proposal }),
  perform: (c, item, p, by) => performInterview(c, item, p, by),
};

export const sendOffer: Performer = {
  prepare: (c, item) => prepareOffer(c, item),
  perform: (c, item, p, by) => performOffer(c, item, p, by),
  onReject: (c, _item, p, by) => cancelOfferOnReject(c, p, by),
};
