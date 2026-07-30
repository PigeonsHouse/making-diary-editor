import {Composition} from "remotion";
import {createProject} from "@/domain/defaults";
import {DiaryVideo, getVideoDuration} from "./DiaryVideo";

const defaultProps = {project: createProject(), characters: []};

export function RemotionRoot() {
  return (
    <Composition
      id="DiaryVideo"
      component={DiaryVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={30}
      defaultProps={defaultProps}
      calculateMetadata={({props}) => ({
        durationInFrames: getVideoDuration(props.project, props.characters),
      })}
    />
  );
}
