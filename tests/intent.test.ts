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

  it("classifies a plain greeting as greeting", () => {
    expect(classifyIntent("Hi")).toBe("greeting");
    expect(classifyIntent("hello!")).toBe("greeting");
    expect(classifyIntent("Hey there")).toBe("greeting");
    expect(classifyIntent("Good morning")).toBe("greeting");
    expect(classifyIntent("  howzit  ")).toBe("greeting");
    expect(classifyIntent("Hello, CalmPath")).toBe("greeting");
  });

  it("does not classify a message that merely starts with a greeting as greeting", () => {
    // A greeting attached to real content must still route to the intent
    // that content actually needs — a cheerful hello would be the wrong
    // response to someone asking where to find support.
    expect(classifyIntent("Hi, I don't know where to find support.")).toBe("navigate");
    expect(classifyIntent("Hello, can you explain what CalmPath does?")).toBe("understand");
    expect(classifyIntent("Hi, I want to plan my week better.")).toBe("plan");
  });

  it("still prioritizes crisis_signal over a greeting-shaped opening", () => {
    expect(classifyIntent("Hi, this feels like an emergency.")).toBe("crisis_signal");
  });
});
