import { describe, expect, it } from "vitest";
import { createCharacter, createProject } from "../domain/defaults";
import { createRenderSignature, stableSerialize } from "./render-cache";

describe("stableSerialize", () => {
  it("produces the same value regardless of object key order", () => {
    expect(stableSerialize({ b: 2, a: { d: 4, c: 3 } })).toBe(stableSerialize({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it("keeps array order because timeline order affects rendering", () => {
    expect(stableSerialize([1, 2])).not.toBe(stableSerialize([2, 1]));
  });

  it("serializes a project document", () => {
    expect(stableSerialize(createProject("cache-test"))).toContain("cache-test");
  });
});

describe("createRenderSignature", () => {
  it("is independent of character query order", () => {
    const project = createProject("signature-test");
    const first = createCharacter();
    const second = createCharacter();
    expect(createRenderSignature(project, [first, second])).toBe(createRenderSignature(project, [second, first]));
  });

  it("changes when render-relevant character data changes", () => {
    const project = createProject("signature-test");
    const character = createCharacter();
    const before = createRenderSignature(project, [character]);
    character.name = "変更後";
    expect(createRenderSignature(project, [character])).not.toBe(before);
  });

  it("changes when a referenced asset default volume changes", () => {
    const project = createProject("signature-test");
    const assetId = "00000000-0000-4000-8000-000000000001";
    expect(createRenderSignature(project, [], { [assetId]: 1 })).not.toBe(
      createRenderSignature(project, [], { [assetId]: 0.5 }),
    );
  });

  it("changes when a referenced asset gains an alpha channel", () => {
    const project = createProject("signature-test");
    const assetId = "00000000-0000-4000-8000-000000000001";
    expect(createRenderSignature(project, [], {}, {})).not.toBe(
      createRenderSignature(project, [], {}, { [assetId]: true }),
    );
  });
});
