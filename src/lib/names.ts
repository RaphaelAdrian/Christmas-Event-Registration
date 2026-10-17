/**
 * Name helpers. These follow the same rules as the database functions
 * name_key(), last_name_key() and first_name_score() in
 * supabase/migrations/20261017000000_name_invite_list.sql, which make the
 * final decision at registration. Here they are used to spot duplicates on
 * the invite list and to split a single "Name" column on import.
 */

/** "Ma. Niña O'Brien-Cruz" -> "ma nina obrien cruz" */
export function nameKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Last names compare without spaces or suffixes: "Dela Cruz Jr." -> "delacruz" */
export function lastNameKey(value: string | null | undefined): string {
  return nameKey(value)
    .replace(/(\s(jr|sr|ii|iii|iv|v))+$/, "")
    .replace(/\s/g, "");
}

/**
 * How well a typed first name fits a listed one: 0 = no match, 1000 = identical,
 * otherwise 2 points per typed word equal to a listed word and 1 point per typed
 * word that starts a listed word (or the other way round), 2+ letters.
 * "Jai" vs "Jairus Miguel" = 1.
 */
export function firstNameScore(entered: string, listed: string): number {
  const e = nameKey(entered);
  const l = nameKey(listed);
  if (!e || !l) return 0;
  if (e === l) return 1000;
  const listedWords = l.split(" ");
  let total = 0;
  for (const word of e.split(" ")) {
    let best = 0;
    for (const lw of listedWords) {
      if (word === lw) {
        best = 2;
        break;
      }
      if (Math.min(word.length, lw.length) >= 2 && (lw.startsWith(word) || word.startsWith(lw))) best = Math.max(best, 1);
    }
    total += best;
  }
  return total;
}

/** True when two invite-list entries are clearly the same person (same first and last name). */
export function sameName(a: { first: string; last: string }, b: { first: string; last: string }) {
  return nameKey(a.first) === nameKey(b.first) && lastNameKey(a.last) === lastNameKey(b.last);
}

const PARTICLES = new Set([
  "de", "del", "dela", "della", "delos", "la", "las", "los", "da", "das", "do", "dos", "di", "du",
  "san", "santa", "santo", "sta", "sta.", "sto", "sto.", "van", "von", "der", "den",
]);
const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);

/**
 * Splits one "Name" cell into first and last name.
 * "Juan dela Cruz" -> Juan / dela Cruz, "Rizal, Jose" -> Jose / Rizal,
 * "Jose Rizal Jr." -> Jose / Rizal Jr., "Jairus Miguel Plantig" -> Jairus Miguel / Plantig
 */
export function splitFullName(value: string): { first: string; last: string } {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return { first: "", last: "" };
  if (clean.includes(",")) {
    const [last, ...rest] = clean.split(",");
    return { first: rest.join(" ").trim(), last: (last ?? "").trim() };
  }
  const words = clean.split(" ");
  if (words.length === 1) return { first: words[0]!, last: "" };

  let end = words.length;
  const suffix: string[] = [];
  while (end > 2 && SUFFIXES.has(words[end - 1]!.toLowerCase())) {
    suffix.unshift(words[end - 1]!);
    end--;
  }
  let start = end - 1;
  while (start > 1 && PARTICLES.has(words[start - 1]!.toLowerCase())) start--;
  return {
    first: words.slice(0, start).join(" "),
    last: [...words.slice(start, end), ...suffix].join(" "),
  };
}
