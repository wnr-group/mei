import { describe, it, expect } from "vitest";
import { buildWhatsAppUrl } from "../whatsapp";

describe("buildWhatsAppUrl", () => {
  it("returns a wa.me URL", () => {
    const url = buildWhatsAppUrl("Hello");
    expect(url).toMatch(/^https:\/\/wa\.me\//);
  });

  it("appends encoded text as query param", () => {
    const url = buildWhatsAppUrl("Hello World");
    expect(url).toContain(`?text=${encodeURIComponent("Hello World")}`);
  });

  it("encodes special characters in message text", () => {
    const url = buildWhatsAppUrl("I'm interested");
    expect(url).toContain(encodeURIComponent("I'm interested"));
  });
});
