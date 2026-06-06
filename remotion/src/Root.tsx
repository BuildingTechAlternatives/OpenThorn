import { Composition } from "remotion";
import { OpenThornLaunchAd } from "./OpenThornLaunchAd";
import { OpenThornAd } from "./OpenThornAd";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="OpenThornLaunchAd"
        component={OpenThornLaunchAd}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="OpenThornAd"
        component={OpenThornAd}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
