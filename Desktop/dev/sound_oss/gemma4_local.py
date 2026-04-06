"""Gemma 4 ローカル推論による音声認識 (ASR)

HuggingFace transformers を使用して Gemma 4 E4B/E2B モデルで
音声ファイルをテキストに変換する。

対応モデル:
  - google/gemma-4-E4B-it (推奨、高精度)
  - google/gemma-4-E2B-it (軽量、エッジ向け)

制約:
  - 最大音声長: 30秒
  - 音声フォーマット: 16kHz モノラル
  - 音声入力 → テキスト出力のみ (TTS非対応)
"""

import numpy as np
import soundfile as sf
from scipy.signal import resample
import torch
from transformers import AutoModelForImageTextToText, AutoProcessor


class Gemma4LocalASR:
    """Gemma 4 によるローカル音声認識クラス"""

    SUPPORTED_MODELS = {
        "e4b": "google/gemma-4-E4B-it",
        "e2b": "google/gemma-4-E2B-it",
    }
    TARGET_SR = 16000
    MAX_DURATION = 30  # 秒

    def __init__(self, model_size: str = "e4b", device: str | None = None):
        model_id = self.SUPPORTED_MODELS.get(model_size)
        if model_id is None:
            raise ValueError(
                f"未対応のモデルサイズ: {model_size}. "
                f"選択肢: {list(self.SUPPORTED_MODELS.keys())}"
            )

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        print(f"モデル読み込み中: {model_id} (device={self.device})")

        self.processor = AutoProcessor.from_pretrained(model_id)
        self.model = AutoModelForImageTextToText.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16 if self.device == "cuda" else torch.float32,
            device_map="auto" if self.device == "cuda" else None,
        )
        if self.device == "cpu":
            self.model = self.model.to(self.device)

        print("モデル読み込み完了")

    def _load_audio(self, audio_path: str) -> np.ndarray:
        """音声ファイルを読み込み、16kHz モノラルに変換する"""
        audio, sr = sf.read(audio_path, dtype="float32")
        # ステレオ→モノラル変換
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        # サンプルレート変換
        if sr != self.TARGET_SR:
            num_samples = int(len(audio) * self.TARGET_SR / sr)
            audio = resample(audio, num_samples).astype(np.float32)
        duration = len(audio) / self.TARGET_SR
        if duration > self.MAX_DURATION:
            print(
                f"警告: 音声が{duration:.1f}秒あります。"
                f"最初の{self.MAX_DURATION}秒のみ処理します。"
            )
            audio = audio[: self.TARGET_SR * self.MAX_DURATION]
        return audio

    def transcribe(
        self,
        audio_path: str,
        language: str = "japanese",
        max_new_tokens: int = 512,
    ) -> str:
        """音声ファイルをテキストに書き起こす

        Args:
            audio_path: 音声ファイルのパス (WAV, MP3等)
            language: 書き起こし言語 ("japanese", "english" 等)
            max_new_tokens: 最大生成トークン数

        Returns:
            書き起こしテキスト
        """
        audio = self._load_audio(audio_path)

        prompt = (
            f"Transcribe the following speech segment in {language}. "
            "Follow these specific instructions for formatting the answer:\n"
            "* Only output the transcription, with no newlines.\n"
            "* When transcribing numbers, write the digits."
        )

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "audio", "audio": audio},
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        inputs = self.processor.apply_chat_template(
            messages,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
            add_generation_prompt=True,
        ).to(self.model.device)

        input_len = inputs["input_ids"].shape[-1]

        with torch.inference_mode():
            outputs = self.model.generate(**inputs, max_new_tokens=max_new_tokens)

        response = self.processor.decode(
            outputs[0][input_len:], skip_special_tokens=True
        )
        return response.strip()

    def translate(
        self,
        audio_path: str,
        source_language: str = "japanese",
        target_language: str = "english",
        max_new_tokens: int = 512,
    ) -> dict:
        """音声を書き起こし、別の言語に翻訳する

        Returns:
            {"transcription": 原文, "translation": 翻訳文}
        """
        audio = self._load_audio(audio_path)

        prompt = (
            f"Transcribe the following speech segment in {source_language}, "
            f"then translate it into {target_language}. "
            "When formatting the answer, first output the transcription in "
            f"{source_language}, then one newline, then output the string "
            f"'{target_language}: ', then the translation in {target_language}."
        )

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "audio", "audio": audio},
                    {"type": "text", "text": prompt},
                ],
            }
        ]

        inputs = self.processor.apply_chat_template(
            messages,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
            add_generation_prompt=True,
        ).to(self.model.device)

        input_len = inputs["input_ids"].shape[-1]

        with torch.inference_mode():
            outputs = self.model.generate(**inputs, max_new_tokens=max_new_tokens)

        response = self.processor.decode(
            outputs[0][input_len:], skip_special_tokens=True
        ).strip()

        lines = response.split("\n", 1)
        transcription = lines[0].strip()
        translation = lines[1].strip() if len(lines) > 1 else ""
        # "english: " のようなプレフィックスを除去
        if ":" in translation:
            translation = translation.split(":", 1)[1].strip()

        return {"transcription": transcription, "translation": translation}
