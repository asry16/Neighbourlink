/**
 * Only same-site paths are allowed as post-login destinations. Rejects
 * absolute URLs ("https://…") and protocol-relative ones ("//evil.com",
 * "/\\evil.com") that browsers treat as another site.
 */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
