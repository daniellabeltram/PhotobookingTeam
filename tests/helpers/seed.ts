// Seeded data. Every PII value is unique and recognisable so tests can grep logs and CSVs for it.
export const ADMIN_EMAIL = "admin@example.test";
/** >= 14 characters (the password tool enforces that). Test-only, never a real secret. */
export const ADMIN_PASSWORD = "e2e-passphrase-for-tests-only";
export const ADMIN_SESSION_SECRET = "e2e-session-secret-0123456789abcdef0123456789abcdef";
export const BASE_URL = "http://localhost:5173";

/** Session type ids as in config (ADR 0007 uses kebab-case ids). Resolve by name via /api/config when in doubt. */
export const TYPE_IDS = {
  portraits: "portraits",
  couples: "couples",
  families: "families",
  events: "events",
  minis: "holiday-minis",
} as const;
export type TypeKey = keyof typeof TYPE_IDS;
export const TYPE_NAMES: Record<TypeKey, string> = {
  portraits: "Portraits",
  couples: "Couples",
  families: "Families",
  events: "Events",
  minis: "Holiday Minis",
};

export const CLIENT = {
  fullName: "Zelda Quillfeather",
  email: "zelda.quillfeather@example.test",
  phone: "5615550142",
  phoneFormatted: "(561) 555-0142",
  subjectsNames: "Zelda, Orville, Pippa, Barnaby",
  childrenAges: "6 and 3",
  styleNotes: "Bright and airy, QA-STYLE-NOTE",
  anythingElse: "Pippa is shy, QA-ANYTHING-ELSE",
};

export const OTHER_CLIENT = {
  fullName: "Mortimer Blackwood",
  email: "mortimer.blackwood@example.test",
  phone: "5615550199",
};

/** All strings that must NEVER appear in captured logs (story 017 #6, architecture section 11). */
export const PII_NEEDLES = [
  CLIENT.fullName,
  CLIENT.email,
  CLIENT.phone,
  CLIENT.phoneFormatted,
  CLIENT.subjectsNames,
  CLIENT.childrenAges,
  "QA-STYLE-NOTE",
  "QA-ANYTHING-ELSE",
  OTHER_CLIENT.fullName,
  OTHER_CLIENT.email,
  OTHER_CLIENT.phone,
  "Quillfeather",
  "Blackwood",
];

/** Strings that try to be formulas in a spreadsheet (story 016 #4). */
export const FORMULA_PAYLOADS = ["=HYPERLINK(\"http://evil.test\",\"x\")", "+1+1", "-2+3", "@SUM(A1:A2)", "\t=1+1", "\r=1+1"];
