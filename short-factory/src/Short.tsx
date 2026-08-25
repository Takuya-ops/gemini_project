import React, { useState } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CUES, Cue, END_CARD_FRAMES } from "./script";
import timing from "./timing.json";
import assets from "./assets.json";

// ---------- フォント読み込み(オフライン: public/fonts の woff2) ----------
const fontWeights = ["400", "700", "900"] as const;
let fontsLoaded = false;
const loadFonts = async () => {
  if (fontsLoaded) return;
  await Promise.all(
    fontWeights.map(async (w) => {
      const font = new FontFace(
        "NotoSansJP",
        `url(${staticFile(`fonts/noto-sans-jp-japanese-${w}-normal.woff2`)}) format('woff2')`,
        { weight: w }
      );
      const loaded = await font.load();
      (document.fonts as unknown as { add: (f: FontFace) => void }).add(loaded);
    })
  );
  fontsLoaded = true;
};

const SECTION_BG: Record<Cue["section"], { from: string; to: string; accent: string }> = {
  hook: { from: "#0B1026", to: "#1D2756", accent: "#FFD500" },
  tools: { from: "#25093F", to: "#4A1B8C", accent: "#C9A2FF" },
  privacy: { from: "#04231D", to: "#0E5741", accent: "#6EF3C5" },
  cost: { from: "#271803", to: "#6B4A0E", accent: "#FFC93C" },
  tips: { from: "#081C2E", to: "#14476B", accent: "#7CD4FF" },
  api: { from: "#052326", to: "#0E5B61", accent: "#66E7D8" },
  outro: { from: "#170610", to: "#451031", accent: "#FF7AB6" },
};

// キーワードをハイライトしてでかテロップを組む
const Caption: React.FC<{ cue: Cue; accent: string }> = ({ cue, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 }, durationInFrames: 18 });
  const scale = interpolate(pop, [0, 1], [1.14, 1]);
  const lines = cue.display.split("\n");

  const renderLine = (line: string, li: number) => {
    let parts: React.ReactNode[] = [line];
    for (const kw of cue.keywords) {
      parts = parts.flatMap((p, pi) => {
        if (typeof p !== "string" || !p.includes(kw)) return [p];
        const segs = p.split(kw);
        const out: React.ReactNode[] = [];
        segs.forEach((s, si) => {
          if (s) out.push(s);
          if (si < segs.length - 1)
            out.push(
              <span key={`${li}-${pi}-${si}`} style={{ color: accent }}>
                {kw}
              </span>
            );
        });
        return out;
      });
    }
    return (
      <div key={li} style={{ whiteSpace: "nowrap" }}>
        {parts}
      </div>
    );
  };

  const longest = Math.max(...lines.map((l) => l.length));
  // 全角想定で1文字≒1em + ストローク分の余白を確保
  const fontSize = Math.min(88, Math.floor(960 / Math.max(longest, 1)));

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 420,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        transform: `scale(${scale})`,
        fontFamily: "NotoSansJP, 'IPAGothic', sans-serif",
        fontWeight: 900,
        fontSize,
        lineHeight: 1.28,
        color: "#FFFFFF",
        textAlign: "center",
        WebkitTextStroke: "10px rgba(0,0,0,0.92)",
        paintOrder: "stroke fill",
        textShadow: "0 10px 34px rgba(0,0,0,0.55)",
        padding: "0 40px",
      }}
    >
      {lines.map(renderLine)}
    </div>
  );
};

// フックの巨大「0円」+ どどど(シェイク)演出
const ZeroYen: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const impact = spring({ frame, fps, config: { damping: 11, mass: 0.9 }, durationInFrames: 20 });
  const scale = interpolate(impact, [0, 1], [2.6, 1]);
  const shakeAmp = interpolate(frame, [0, 14], [26, 0], { extrapolateRight: "clamp" });
  const dx = (random(`zx-${frame}`) - 0.5) * shakeAmp;
  const dy = (random(`zy-${frame}`) - 0.5) * shakeAmp;
  const burstRot = frame * 0.6;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 2400,
          height: 2400,
          borderRadius: "50%",
          background: `repeating-conic-gradient(from ${burstRot}deg, rgba(255,213,0,0.16) 0deg 7deg, transparent 7deg 16deg)`,
          maskImage: "radial-gradient(circle, black 0%, transparent 62%)",
          WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 62%)",
        }}
      />
      <div
        style={{
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
          fontFamily: "NotoSansJP, 'IPAGothic', sans-serif",
          fontWeight: 900,
          fontSize: 200,
          color: "#FFFFFF",
          WebkitTextStroke: "14px rgba(0,0,0,0.92)",
          paintOrder: "stroke fill",
          textAlign: "center",
          lineHeight: 1.05,
          textShadow: `0 0 90px ${accent}66, 0 14px 40px rgba(0,0,0,0.6)`,
          marginBottom: 620,
        }}
      >
        <div style={{ fontSize: 96 }}>利用料</div>
        <div>
          <span style={{ fontSize: 430, color: accent }}>0</span>
          <span style={{ fontSize: 230 }}>円</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const StepBadge: React.FC<{ step: number; accent: string }> = ({ step, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 }, durationInFrames: 16 });
  return (
    <div
      style={{
        position: "absolute",
        top: 330,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        transform: `scale(${interpolate(pop, [0, 1], [0.3, 1])})`,
      }}
    >
      <div
        style={{
          width: 210,
          height: 210,
          borderRadius: "50%",
          background: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "NotoSansJP, 'IPAGothic', sans-serif",
          fontWeight: 900,
          fontSize: 120,
          color: "#0A0A14",
          boxShadow: "0 16px 50px rgba(0,0,0,0.5)",
        }}
      >
        {step}
      </div>
    </div>
  );
};

// セクション見出し(画面上部の帯)
const SECTION_LABEL: Record<Cue["section"], string> = {
  hook: "",
  tools: "使うもの",
  privacy: "プライバシー",
  cost: "コスト",
  tips: "設定のコツ",
  api: "API連携",
  outro: "",
};

const SectionLabel: React.FC<{ cue: Cue; accent: string }> = ({ cue, accent }) => {
  const label = SECTION_LABEL[cue.section];
  if (!label) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 190,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: "NotoSansJP, 'IPAGothic', sans-serif",
          fontWeight: 700,
          fontSize: 44,
          letterSpacing: 8,
          color: "#0A0A14",
          background: accent,
          borderRadius: 999,
          padding: "12px 44px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const CueScene: React.FC<{ cue: Cue }> = ({ cue }) => {
  const frame = useCurrentFrame();
  const bg = SECTION_BG[cue.section];
  const drift = interpolate(frame, [0, 300], [0, 40]);
  const hasBroll = (assets.broll as string[]).includes(cue.id);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(${160 + drift * 0.2}deg, ${bg.from} 0%, ${bg.to} 100%)`,
        }}
      />
      {hasBroll ? (
        <AbsoluteFill>
          <Img
            src={staticFile(`broll/${cue.id}.png`)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${1.06 + frame * 0.0006})`,
              opacity: 0.92,
            }}
          />
          <AbsoluteFill
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.55) 100%)",
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.06) 2px, transparent 2px)",
            backgroundSize: "64px 64px",
            backgroundPosition: `0 ${-drift}px`,
          }}
        />
      )}
      {/* ビネット */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)",
        }}
      />
      {cue.id === "c02" ? <ZeroYen accent={bg.accent} /> : null}
      {cue.step ? <StepBadge step={cue.step} accent={bg.accent} /> : null}
      <SectionLabel cue={cue} accent={bg.accent} />
      <Caption cue={cue} accent={bg.accent} />
      {cue.se ? <Audio src={staticFile("se_don.wav")} volume={0.55} /> : null}
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 13 }, durationInFrames: 20 });
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(165deg, #12071C 0%, #3A0F45 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "NotoSansJP, 'IPAGothic', sans-serif",
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})`,
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 96,
            WebkitTextStroke: "10px rgba(0,0,0,0.9)",
            paintOrder: "stroke fill",
            lineHeight: 1.3,
          }}
        >
          詳しい手順は
          <br />
          <span style={{ color: "#FFD500" }}>概要欄</span>をチェック
        </div>
        <div
          style={{
            marginTop: 60,
            fontWeight: 700,
            fontSize: 46,
            color: "#E8D9FF",
          }}
        >
          フォローで最新AI情報をお届け
        </div>
        <div
          style={{
            marginTop: 26,
            fontWeight: 700,
            fontSize: 40,
            color: "#B99BD8",
          }}
        >
          @takuya_genai
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Short: React.FC = () => {
  const [handle] = useState(() => delayRender("load fonts"));
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  React.useEffect(() => {
    loadFonts().then(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A14" }}>
      {timing.cues.map((t) => {
        const cue = CUES.find((c) => c.id === t.id);
        if (!cue) return null;
        return (
          <Sequence key={t.id} from={t.startFrame} durationInFrames={t.durationFrames}>
            <CueScene cue={cue} />
          </Sequence>
        );
      })}
      <Sequence from={timing.speechEndFrame} durationInFrames={END_CARD_FRAMES}>
        <EndCard />
      </Sequence>

      {/* ナレーション音声(TTS完成後に assets.json の voice を設定) */}
      {assets.voice ? <Audio src={staticFile(assets.voice)} /> : null}

      {/* AI音声の小表記(常時) */}
      <div
        style={{
          position: "absolute",
          top: 84,
          right: 36,
          fontFamily: "NotoSansJP, 'IPAGothic', sans-serif",
          fontWeight: 700,
          fontSize: 30,
          color: "rgba(255,255,255,0.85)",
          background: "rgba(0,0,0,0.4)",
          borderRadius: 999,
          padding: "8px 24px",
          letterSpacing: 3,
        }}
      >
        AI音声
      </div>

      {/* 進行バー */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 12,
          width: `${(frame / durationInFrames) * 100}%`,
          background: "linear-gradient(90deg, #FFD500, #FF7AB6)",
        }}
      />
    </AbsoluteFill>
  );
};
