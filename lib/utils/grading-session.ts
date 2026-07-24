const naturalTextCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const matrixLabCodes = ["LAB1", "LAB2", "LAB3"] as const;

export function compareNaturalText(left: string, right: string) {
  return naturalTextCollator.compare(left, right);
}

export function normalizeLabCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function selectLatestMatrixLabSessions<T extends { lab_code: string; created_at: string }>(
  sessions: T[]
) {
  const latestByLab = new Map<string, T>();
  for (const session of sessions) {
    const labCode = normalizeLabCode(session.lab_code);
    if (!matrixLabCodes.includes(labCode as (typeof matrixLabCodes)[number])) continue;

    const current = latestByLab.get(labCode);
    if (!current || session.created_at.localeCompare(current.created_at) > 0) {
      latestByLab.set(labCode, session);
    }
  }

  return matrixLabCodes
    .map((labCode) => latestByLab.get(labCode))
    .filter((session): session is T => Boolean(session));
}

export function normalizeOptionalUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    throw new Error("Drive root must be a valid URL");
  }
}

export function normalizeSessionDeadline(value: string | null, allowPast = false) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("Deadline is invalid");
  if (!allowPast && timestamp <= Date.now()) throw new Error("Deadline must be in the future");
  return new Date(timestamp).toISOString();
}

export function uniqueIds(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
