"""Edge TTS による音声合成

Microsoft Edge の無料TTS APIを使用。
APIキー不要で高品質な音声合成が可能。

日本語の主な声:
  - ja-JP-NanamiNeural (女性, デフォルト)
  - ja-JP-KeitaNeural (男性)
"""

import asyncio
from pathlib import Path

import edge_tts


# 日本語で利用可能な主な声
JAPANESE_VOICES = {
    "nanami": "ja-JP-NanamiNeural",   # 女性
    "keita": "ja-JP-KeitaNeural",     # 男性
}

# 英語で利用可能な主な声
ENGLISH_VOICES = {
    "aria": "en-US-AriaNeural",       # 女性
    "guy": "en-US-GuyNeural",         # 男性
    "jenny": "en-US-JennyNeural",     # 女性
}


class EdgeTTS:
    """Edge TTS による音声合成クラス (APIキー不要)"""

    def __init__(self, voice: str = "nanami"):
        all_voices = {**JAPANESE_VOICES, **ENGLISH_VOICES}
        if voice in all_voices:
            self.voice = all_voices[voice]
        else:
            # フルネーム指定 (例: "ja-JP-NanamiNeural")
            self.voice = voice
        print(f"Edge TTS 準備完了: {self.voice}")

    async def _synthesize_async(
        self,
        text: str,
        output_path: str,
        rate: str = "+0%",
        pitch: str = "+0Hz",
    ) -> str:
        """非同期で音声合成を実行"""
        communicate = edge_tts.Communicate(
            text=text,
            voice=self.voice,
            rate=rate,
            pitch=pitch,
        )
        await communicate.save(output_path)
        size = Path(output_path).stat().st_size
        print(f"音声生成完了: {output_path} ({size} bytes)")
        return output_path

    def synthesize(
        self,
        text: str,
        output_path: str = "output.mp3",
        rate: str = "+0%",
        pitch: str = "+0Hz",
    ) -> str:
        """テキストから音声を合成する

        Args:
            text: 合成するテキスト
            output_path: 出力ファイルのパス (MP3)
            rate: 速度調整 (例: "+20%", "-10%")
            pitch: ピッチ調整 (例: "+5Hz", "-5Hz")

        Returns:
            出力ファイルのパス
        """
        return asyncio.run(self._synthesize_async(text, output_path, rate, pitch))

    @staticmethod
    async def list_voices_async(language: str = "ja") -> list[dict]:
        """利用可能な声の一覧を取得"""
        voices = await edge_tts.list_voices()
        return [v for v in voices if v["Locale"].startswith(language)]

    @staticmethod
    def list_voices(language: str = "ja") -> list[dict]:
        """利用可能な声の一覧を取得"""
        return asyncio.run(EdgeTTS.list_voices_async(language))
