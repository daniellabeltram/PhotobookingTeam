// Fills the {{placeholders}} in a policy summary template (story 006 #2). Used by the browser,
// the emails and the policies page, so the numbers always come from config.
export function renderPolicySummary(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (whole, key: string) => {
    const v = values[key];
    return v === undefined ? whole : String(v);
  });
}
