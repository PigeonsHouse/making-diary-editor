import type { ProjectDocument } from "@/domain/types";
import type { EditorTab } from "./types";

export function getPreviewProject(project: ProjectDocument, activeTab: EditorTab): ProjectDocument {
  if (activeTab === "general") return project;
  if (activeTab === "support") return { ...project, wishList: null, diaries: [] };
  const withoutSupport = {
    ...project,
    supportCredits: { ...project.supportCredits, cache: null, narrations: [] },
  };
  if (activeTab === "wish") return { ...withoutSupport, diaries: [] };

  const diaryId = activeTab.slice("diary:".length);
  const diary = project.diaries.find((item) => item.id === diaryId);
  return diary ? { ...withoutSupport, wishList: null, diaries: [diary] } : project;
}
