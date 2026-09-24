import type { AdminModifierGroup } from "@/lib/admin/repository";

export const describeGroup = (g: Pick<AdminModifierGroup, "min" | "max" | "options">) =>
  `${g.min > 0 ? "Required" : "Optional"} · ${g.max === 1 ? "pick 1" : `up to ${g.max}`} · ${g.options.map((o) => o.name).join(", ")}`;
