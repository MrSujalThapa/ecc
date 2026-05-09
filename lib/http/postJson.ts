/**
 * Browser POST helper for Next.js API routes (same-origin).
 */

export type PostJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  errorText: string;
};

export const postJson = async <T,>(
  url: string,
  body: unknown
): Promise<PostJsonResult<T>> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const errorText = await res.text();
  let data: T | null = null;
  try {
    data = JSON.parse(errorText) as T;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, errorText };
};
