const naturalTextCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function compareNaturalText(left: string, right: string) {
  return naturalTextCollator.compare(left, right);
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
