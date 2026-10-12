/**
 * Office @handles for staff members (pure: shared by the Office client and the server).
 * A Vietnamese colleague is called by the given name: "Chị Hà" → @ha, "Nguyễn Văn Minh" → @minh.
 * Handles are unique among the staff passed in (in that order) and never collide with a reserved handle (agents, @nivo):
 * a second "Hà" becomes @ha2. Pass active staff in the same order everywhere (created_at) so every screen agrees.
 */
const HONORIFICS = new Set(["anh", "chi", "em", "co", "chu", "ong", "ba", "bac", "di", "thay", "mr", "mrs", "ms", "sep"]);

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/\([^)]*\)/g, " ");

/** Base handle of one name, before de-duplication. */
export const baseStaffHandle = (name: string): string => {
  const words = fold(name).split(/[^a-z0-9]+/).filter(Boolean);
  const named = words.filter((w) => !HONORIFICS.has(w));
  const pick = named.at(-1) ?? words.at(-1) ?? "staff";
  return pick.slice(0, 16) || "staff";
};

/** id → handle for every staff member given, unique and clear of the reserved handles. */
export const staffHandles = (staff: ReadonlyArray<{ readonly id: string; readonly name: string }>, reserved: ReadonlyArray<string> = []): Map<string, string> => {
  const taken = new Set(["nivo", ...reserved.map((h) => h.toLowerCase())]);
  const out = new Map<string, string>();
  for (const s of staff) {
    const base = baseStaffHandle(s.name);
    let handle = base;
    for (let n = 2; taken.has(handle); n++) handle = `${base}${n}`;
    taken.add(handle);
    out.set(s.id, handle);
  }
  return out;
};
