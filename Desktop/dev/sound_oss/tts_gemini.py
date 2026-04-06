"""Gemini 2.5 Flash TTS による音声合成

Google AI Studio API を使用してテキストから音声を生成する。

対応:
  - 24言語 (日本語含む)
  - 30種類の声
  - マルチスピーカー (最大2人)
  - スタイル制御 (プロンプトで指定)

音声フォーマット: 16bit PCM, 24000Hz, モノラル

事前準備:
  1. https://aistudio.google.com/ でAPIキーを取得
  2. 環境変数 GOOGLE_API_KEY に設定
"""

import os
import wave
from pathlib import Path

from google import genai
from google.genai import types


AVAILABLE_VOICES = [
    "Achernar", "Achird", "Algenib", "Algieba", "Alnilam",
    "Aoede", "Autonoe", "Callirrhoe", "Charon", "Despina",
    "Enceladus", "Erinome", "Fenrir", "Gacrux", "Iapetus",
    "Kore", "Laomedeia", "Leda", "Orus", "Puck",
    "Pulcherrima", "Rasalgethi", "Sadachbia", "Sadaltager", "Schedar",
    "Sulafat", "Umbriel", "Vindemiatrix", "Zephyr", "Zubenelgenubi",
]


class GeminiTTS:
    """Gemini 2.5 Flash TTS による音声合成クラス"""

    def __init__(self, api_key: str | None = None):
        api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "APIキーが必要です。環境変数 GOOGLE_API_KEY を設定するか、"
                "api_key 引数で指定してください。"
            )

        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash-preview-tts"
        print(f"TTS準備完了: {self.model_name}")

    @staticmethod
    def _save_wav(filepath: str, pcm_data: bytes, sample_rate: int = 24000):
        """PCMデータをWAVファイルとして保存"""
        with wave.open(filepath, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16bit
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_data)

    def synthesize(
        self,
        text: str,
        output_path: str = "output.wav",
        voice: str = "Kore",
        style: str | None = None,
    ) -> str:
        """テキストから音声を合成する

        Args:
            text: 合成するテキスト
            output_path: 出力WAVファイルのパス
            voice: 声の名前 (デフォルト: Kore)
            style: スタイル指定 (例: "明るく元気に", "ささやくように")

        Returns:
            出力ファイルのパス
        """
        if voice not in AVAILABLE_VOICES:
            raise ValueError(
                f"未対応の声: {voice}. 利用可能: {AVAILABLE_VOICES}"
            )

        content = f"{style}：{text}" if style else text

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=content,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice,
                        )
                    )
                ),
            ),
        )

        if not response.candidates or not response.candidates[0].content.parts:
            raise RuntimeError(
                "音声生成に失敗しました。テキストが短すぎるか、APIの制限に達した可能性があります。"
            )

        pcm_data = response.candidates[0].content.parts[0].inline_data.data
        self._save_wav(output_path, pcm_data)
        print(f"音声生成完了: {output_path} ({len(pcm_data)} bytes)")
        return output_path

    def synthesize_dialogue(
        self,
        script: str,
        output_path: str = "dialogue.wav",
        speakers: dict[str, str] | None = None,
    ) -> str:
        """対話スクリプトからマルチスピーカー音声を合成する

        Args:
            script: 対話テキスト (例: "太郎: こんにちは\\n花子: こんにちは")
            output_path: 出力WAVファイルのパス
            speakers: スピーカー名→声のマッピング (最大2人)

        Returns:
            出力ファイルのパス
        """
        if speakers is None:
            speakers = {}

        # 全角コロンを半角に統一
        script = script.replace("：", ":")

        # スクリプトからスピーカーを自動検出
        detected = []
        for line in script.strip().split("\n"):
            if ":" in line:
                name = line.split(":", 1)[0].strip()
                if name not in detected:
                    detected.append(name)

        if len(detected) > 2:
            print(f"警告: {len(detected)}人検出されましたが、最大2人までです。最初の2人を使用します。")
            detected = detected[:2]

        default_voices = ["Kore", "Puck"]
        speaker_configs = []
        for i, name in enumerate(detected):
            voice = speakers.get(name, default_voices[i % len(default_voices)])
            speaker_configs.append(
                types.SpeakerVoiceConfig(
                    speaker=name,
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice,
                        )
                    ),
                )
            )

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=script,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                            speaker_voice_configs=speaker_configs,
                        )
                    ),
                ),
            )
            pcm_data = response.candidates[0].content.parts[0].inline_data.data
            self._save_wav(output_path, pcm_data)
            print(f"対話音声生成完了: {output_path} ({len(pcm_data)} bytes)")
            return output_path
        except Exception as e:
            print(f"マルチスピーカー生成失敗 ({e}). シングルスピーカーで合成します。")
            # フォールバック: 全テキストを1つの声で合成
            lines = script.strip().split("\n")
            full_text = " ".join(
                line.split(":", 1)[1].strip() if ":" in line else line
                for line in lines
            )
            return self.synthesize(full_text, output_path, voice=default_voices[0])
