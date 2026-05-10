/**
 * Operator availability for transfer gating.
 * Set OPERATOR_AVAILABILITY=busy to keep AI on the line while still collecting details.
 */

export type OperatorAvailability = "free" | "busy";

export const getOperatorAvailability = (): OperatorAvailability => {
  const raw = (process.env.OPERATOR_AVAILABILITY ?? "free")
    .toString()
    .trim()
    .toLowerCase();
  if (raw === "busy") return "busy";
  return "free";
};
