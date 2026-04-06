"""Google AI Studio API 経由の音声認識 (ASR)

Google AI Studio の API を使用して音声認識を行う。
ローカルにGPUがなくても利用可能。

モデル選択:
  - 音声認識 (ASR): Gemini 2.5 Flash (API上でGemmaは音声非対応のため)
  - ローカル推論でGemma 4を使う場合は gemma4_local.py を参照

事前準備:
  1. https://aistudio.google.com/ でAPIキーを取得
  2. 環境変数 GOOGLE_API_KEY に設定
"""

import os
from pathlib import Path

from google import genai
from google.genai import types


class GeminiApiASR:
    """Google AI Studio API 経由の音声認識クラス"""

    SUPPORTED_MODELS = {
        "gemini-2.5-flash": "models/gemini-2.5-flash",
        "gemini-2.5-pro": "models/gemini-2.5-pro",
        "gemini-2.0-flash": "models/gemini-2.0-flash",
    }

    def __init__(self, model_name: str = "gemini-2.5-flash", api_key: str | None = None):
        api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "APIキーが必要です。環境変数 GOOGLE_API_KEY を設定するか、"
                "api_key 引数で指定してください。"
            )

        model_id = self.SUPPORTED_MODELS.get(model_name)
        if model_id is None:
            raise ValueError(
                f"未対応のモデル: {model_name}. "
                f"選択肢: {list(self.SUPPORTED_MODELS.keys())}"
            )

        self.client = genai.Client(api_key=api_key)
        self.model_name = model_id
        print(f"API接続準備完了: {model_id}")

    def _read_audio(self, audio_path: str) -> types.Part:
        """音声ファイルを読み込んでPartオブジェクトを作成する"""
        path = Path(audio_path)
        if not path.exists():
            raise FileNotFoundError(f"音声ファイルが見つかりません: {audio_path}")

        mime_types = {
            ".wav": "audio/wav",
            ".mp3": "audio/mpeg",
            ".flac": "audio/flac",
            ".ogg": "audio/ogg",
            ".m4a": "audio/mp4",
        }
        mime_type = mime_types.get(path.suffix.lower(), "audio/wav")

        audio_bytes = path.read_bytes()
        print(f"音声ファイル読み込み完了: {path.name} ({len(audio_bytes)} bytes)")
        return types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)

    def transcribe(
        self,
        audio_path: str,
        language: str = "japanese",
    ) -> str:
        """音声ファイルをテキストに書き起こす

        Args:
            audio_path: 音声ファイルのパス (WAV, MP3等)
            language: 書き起こし言語 ("japanese", "english" 等)

        Returns:
            書き起こしテキスト
        """
        audio_part = self._read_audio(audio_path)

        prompt = (
            f"Transcribe the following speech segment in {language}. "
            "Follow these specific instructions for formatting the answer:\n"
            "* Only output the transcription, with no newlines.\n"
            "* When transcribing numbers, write the digits."
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[audio_part, prompt],
        )
        return response.text.strip()

    def translate(
        self,
        audio_path: str,
        source_language: str = "japanese",
        target_language: str = "english",
    ) -> dict:
        """音声を書き起こし、別の言語に翻訳する

        Returns:
            {"transcription": 原文, "translation": 翻訳文}
        """
        audio_part = self._read_audio(audio_path)

        prompt = (
            f"Transcribe the following speech segment in {source_language}, "
            f"then translate it into {target_language}. "
            "Format your response exactly as follows (2 lines only):\n"
            "Line 1: The transcription\n"
            "Line 2: The translation\n"
            "Do not include any labels, prefixes, or extra text."
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[audio_part, prompt],
        )
        text = response.text.strip()

        lines = [line.strip() for line in text.split("\n") if line.strip()]
        transcription = lines[0] if lines else ""
        translation = " ".join(lines[1:]) if len(lines) > 1 else ""

        return {"transcription": transcription, "translation": translation}
