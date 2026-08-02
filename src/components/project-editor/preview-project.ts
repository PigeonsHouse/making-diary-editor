import type {ProjectDocument} from "@/domain/types";
import type {EditorTab} from "./types";

export function getPreviewProject(project: ProjectDocument, activeTab: EditorTab): ProjectDocument {
  if (activeTab === "general") return project;
  if (activeTab === "wish") return {...project, diaries: []};

  const diaryId = activeTab.slice("diary:".length);
  const diary = project.diaries.find((item) => item.id === diaryId);
  return diary ? {...project, wishList: null, diaries: [diary]} : project;
}
