import React from "react";
import { Composition } from "remotion";
import { Short } from "./Short";
import { FPS, WIDTH, HEIGHT, END_CARD_FRAMES } from "./script";
import timing from "./timing.json";

export const Root: React.FC = () => {
  return (
    <Composition
      id="Short"
      component={Short}
      durationInFrames={timing.speechEndFrame + END_CARD_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
