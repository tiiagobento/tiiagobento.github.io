import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("defines Android install metadata", () => {
    const data = manifest();

    expect(data.name).toBe("Nova Forma CRM");
    expect(data.short_name).toBe("Nova Forma");
    expect(data.display).toBe("standalone");
    expect(data.orientation).toBe("portrait");
    expect(data.start_url).toBe("/dashboard");
    expect(data.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/nova-forma-icon-192.png", sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ src: "/icons/nova-forma-icon-512.png", sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ src: "/icons/nova-forma-icon.svg", purpose: "maskable" }),
    ]));
  });
});
