import { Config } from "@remotion/cli/config";

// この環境はプリインストールChromiumを使う(playwright installは不可)
Config.setBrowserExecutable(
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("swangle");
