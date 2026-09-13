import { z } from "zod";
import resourceData from "../data/resources.za.json";

const ResourceEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  officialUrl: z.string().nullable(),
  contact: z.string().nullable(),
});

const ResourceRegistrySchema = z.object({
  registryStatus: z.enum(["verified", "unverified-demonstration"]),
  resources: z.array(ResourceEntrySchema),
});

export type ResourceRegistry = z.infer<typeof ResourceRegistrySchema>;

/**
 * Boundary validation for external/static resource data. If the file is
 * malformed we fail closed to an empty, clearly-unverified registry rather
 * than surfacing unvetted contact details.
 */
function loadRegistry(): ResourceRegistry {
  const parsed = ResourceRegistrySchema.safeParse(resourceData);
  if (!parsed.success) {
    return { registryStatus: "unverified-demonstration", resources: [] };
  }
  return parsed.data;
}

export const resourceRegistry = loadRegistry();

/**
 * A single line describing available support pathways. Per SAFETY.md,
 * unverified demonstration resources must be visibly marked as such;
 * only a registryStatus of "verified" may omit that marking.
 */
export function crisisResourceLine(): string {
  if (resourceRegistry.resources.length === 0) {
    return "Please contact local emergency services or a crisis line, or reach out to someone you trust.";
  }

  const names = resourceRegistry.resources.map((r) => r.name).join(", ");
  const marker =
    resourceRegistry.registryStatus === "unverified-demonstration"
      ? " (demonstration list — not yet verified)"
      : "";

  return `You could reach out to: ${names}${marker}.`;
}
