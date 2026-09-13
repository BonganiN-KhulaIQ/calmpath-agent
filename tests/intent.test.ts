import { describe, expect, it } from "vitest";
import { classifyIntent } from "../src/agent/intent";

describe("classifyIntent", () => {
  it("does not misclassify ordinary words containing 'die' as a crisis signal", () => {
    // Found via integration testing: "studies" contains "die" as a bare
    // substring, and the original regex had no word boundaries.
    expect(classifyIntent("I feel overwhelmed and hopeless about my studies.")).not.toBe("crisis_signal");
    expect(classifyIntent("My diet has been all over the place lately.")).not.toBe("crisis_signal");
  });

  it("still classifies genuine crisis language as crisis_signal", () => {
    expect(classifyIntent("I don't want to hurt myself but I feel awful.")).toBe("crisis_signal");
    expect(classifyIntent("I just want to die.")).toBe("crisis_signal");
    expect(classifyIntent("This feels like an emergency.")).toBe("crisis_signal");
  });
});
