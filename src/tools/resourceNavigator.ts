import type { ToolFn } from "./types";
import { resourceRegistry } from "../safety/resources";

/** Surfaces the (clearly-marked) resource registry. Never presents unverified entries as verified. */
export const resourceNavigator: ToolFn = () => {
  const marker =
    resourceRegistry.registryStatus === "unverified-demonstration"
      ? " (demonstration list — not yet verified)"
      : "";

  const details =
    resourceRegistry.resources.length > 0
      ? resourceRegistry.resources.map((r) => `${r.name}${marker}`)
      : ["Local emergency services or a trusted crisis line"];

  return {
    toolId: "resource_navigator",
    summary: "Here are some support options you could look into:",
    details,
  };
};
