import { notFound } from "./http-error";

/** Positive integer route param; anything else is treated as "not found". */
export function parseId(value: string) {
  if (!/^\d{1,9}$/.test(value)) throw notFound();
  return Number(value);
}
