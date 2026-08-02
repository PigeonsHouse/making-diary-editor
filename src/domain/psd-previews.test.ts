import { describe, expect, it } from "vitest";
import { createCharacter, createDialogue, createDiary, createProject } from "./defaults";
import { createDialoguePsdPreviewSpecs, resolveDialogueAvatarUrl } from "./psd-previews";

describe("createDialoguePsdPreviewSpecs", () => {
  it("collects and deduplicates explicit dialogue PSD overrides", () => {
    const character = createCharacter();
    character.psdAssetId = "00000000-0000-4000-8000-000000000001";
    character.psdDefaults = { expression: "normal" };
    character.psdFilters = {
      expression: {
        targets: ["face"],
        choiceOrder: ["normal", "smile"],
        choices: { normal: { show: ["face/normal"] }, smile: { show: ["face/smile"] } },
      },
    };
    const project = createProject();
    const diary = createDiary();
    const first = createDialogue(character.id);
    const second = createDialogue(character.id);
    first.psdOverrides = { expression: "smile" };
    second.psdOverrides = { expression: "smile" };
    diary.blocks[0].dialogues = [first, second];
    project.diaries = [diary];

    const specs = createDialoguePsdPreviewSpecs(project, [character]);
    expect(specs).toHaveLength(1);
    expect(specs[0].selections).toEqual({ expression: "smile" });
    expect(specs[0].dialogueIds).toEqual([first.id, second.id]);
  });

  it("ignores dialogues without an explicit override", () => {
    const character = createCharacter();
    character.psdAssetId = "00000000-0000-4000-8000-000000000001";
    const project = createProject();
    const diary = createDiary();
    diary.blocks[0].dialogues = [createDialogue(character.id)];
    project.diaries = [diary];

    expect(createDialoguePsdPreviewSpecs(project, [character])).toEqual([]);
  });

  it("uses the latest started dialogue preview for the same character", () => {
    const character = createCharacter();
    const first = createDialogue(character.id);
    const second = createDialogue(character.id);

    expect(
      resolveDialogueAvatarUrl("default.png", character.id, [first, second], {
        [first.id]: "first.png",
        [second.id]: "second.png",
      }),
    ).toBe("second.png");
    expect(resolveDialogueAvatarUrl("default.png", character.id, [first], {})).toBe("default.png");
  });

  it("returns to the default when the next dialogue has no override", () => {
    const character = createCharacter();
    const first = createDialogue(character.id);
    const second = createDialogue(character.id);

    expect(
      resolveDialogueAvatarUrl("default.png", character.id, [first, second], {
        [first.id]: "first.png",
      }),
    ).toBe("default.png");
  });

  it("keeps an override when another character starts speaking", () => {
    const character = createCharacter();
    const otherCharacter = createCharacter();
    const first = createDialogue(character.id);
    const second = createDialogue(otherCharacter.id);

    expect(
      resolveDialogueAvatarUrl("default.png", character.id, [first, second], {
        [first.id]: "first.png",
      }),
    ).toBe("first.png");
  });
});
