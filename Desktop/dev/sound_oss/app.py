"""音声認識・音声合成 Web UI (Gradio)

起動:
  export GOOGLE_API_KEY="your-api-key"
  python app.py

ブラウザで http://localhost:7860 を開く
"""

import os
import tempfile

import gradio as gr

from gemma4_api import GeminiApiASR
from tts_gemini import GeminiTTS, AVAILABLE_VOICES
from tts_edge import EdgeTTS, JAPANESE_VOICES, ENGLISH_VOICES


# --- 初期化 ---
api_key = os.environ.get("GOOGLE_API_KEY")


def get_asr():
    return GeminiApiASR(model_name="gemini-2.5-flash", api_key=api_key)


def get_gemini_tts():
    return GeminiTTS(api_key=api_key)


# ===========================================
#  音声認識 (ASR) タブ
# ===========================================

def transcribe_audio(audio_path, language):
    """音声ファイルを書き起こす"""
    if audio_path is None:
        return "音声ファイルをアップロードまたは録音してください。"
    try:
        asr = get_asr()
        return asr.transcribe(audio_path, language=language)
    except Exception as e:
        return f"エラー: {e}"


def translate_audio(audio_path, source_lang, target_lang):
    """音声を書き起こして翻訳する"""
    if audio_path is None:
        return "", ""
    try:
        asr = get_asr()
        result = asr.translate(audio_path, source_lang, target_lang)
        return result["transcription"], result["translation"]
    except Exception as e:
        return f"エラー: {e}", ""


# ===========================================
#  音声合成 (TTS) タブ
# ===========================================

def synthesize_gemini(text, voice, style):
    """Gemini TTSで音声合成"""
    if not text.strip():
        return None
    try:
        tts = get_gemini_tts()
        output_path = tempfile.mktemp(suffix=".wav")
        tts.synthesize(
            text=text,
            output_path=output_path,
            voice=voice,
            style=style if style.strip() else None,
        )
        return output_path
    except Exception as e:
        raise gr.Error(f"Gemini TTS エラー: {e}")


def synthesize_edge(text, voice_key, rate, pitch):
    """Edge TTSで音声合成"""
    if not text.strip():
        return None
    try:
        tts = EdgeTTS(voice=voice_key)
        output_path = tempfile.mktemp(suffix=".mp3")
        tts.synthesize(
            text=text,
            output_path=output_path,
            rate=rate,
            pitch=pitch,
        )
        return output_path
    except Exception as e:
        raise gr.Error(f"Edge TTS エラー: {e}")


# ===========================================
#  音声変換 (ASR → TTS) タブ
# ===========================================

def voice_to_voice(audio_path, source_lang, target_lang, tts_voice):
    """音声→翻訳→音声合成のパイプライン"""
    if audio_path is None:
        return "", "", None
    try:
        # Step 1: 書き起こし + 翻訳
        asr = get_asr()
        result = asr.translate(audio_path, source_lang, target_lang)
        transcription = result["transcription"]
        translation = result["translation"]

        # Step 2: 翻訳テキストを音声合成
        tts = get_gemini_tts()
        output_path = tempfile.mktemp(suffix=".wav")
        tts.synthesize(
            text=translation,
            output_path=output_path,
            voice=tts_voice,
        )
        return transcription, translation, output_path
    except Exception as e:
        return f"エラー: {e}", "", None


# ===========================================
#  UI構築
# ===========================================

def build_ui():
    with gr.Blocks(title="音声認識・音声合成 デモ") as demo:
        gr.Markdown("# 音声認識・音声合成 デモ")
        gr.Markdown("Gemini API / Edge TTS を使った音声処理ツール")

        with gr.Tabs():
            # --- 音声認識タブ ---
            with gr.TabItem("音声認識 (ASR)"):
                gr.Markdown("### 音声をテキストに変換")
                with gr.Row():
                    with gr.Column():
                        asr_audio = gr.Audio(
                            label="音声入力 (アップロードまたはマイク録音)",
                            type="filepath",
                        )
                        asr_lang = gr.Dropdown(
                            choices=["japanese", "english", "chinese", "korean",
                                     "french", "german", "spanish"],
                            value="japanese",
                            label="言語",
                        )
                        asr_btn = gr.Button("書き起こし", variant="primary")
                    with gr.Column():
                        asr_output = gr.Textbox(label="書き起こし結果", lines=5)

                asr_btn.click(
                    fn=transcribe_audio,
                    inputs=[asr_audio, asr_lang],
                    outputs=asr_output,
                )

                gr.Markdown("---")
                gr.Markdown("### 音声翻訳")
                with gr.Row():
                    with gr.Column():
                        trans_audio = gr.Audio(
                            label="音声入力",
                            type="filepath",
                        )
                        with gr.Row():
                            trans_src = gr.Dropdown(
                                choices=["japanese", "english", "chinese", "korean"],
                                value="japanese", label="元の言語",
                            )
                            trans_tgt = gr.Dropdown(
                                choices=["english", "japanese", "chinese", "korean",
                                         "french", "german", "spanish"],
                                value="english", label="翻訳先",
                            )
                        trans_btn = gr.Button("翻訳", variant="primary")
                    with gr.Column():
                        trans_original = gr.Textbox(label="書き起こし (原文)", lines=3)
                        trans_result = gr.Textbox(label="翻訳結果", lines=3)

                trans_btn.click(
                    fn=translate_audio,
                    inputs=[trans_audio, trans_src, trans_tgt],
                    outputs=[trans_original, trans_result],
                )

            # --- 音声合成タブ ---
            with gr.TabItem("音声合成 (TTS)"):
                with gr.Tabs():
                    with gr.TabItem("Gemini TTS"):
                        gr.Markdown("### Gemini 2.5 Flash TTS (高品質・30種類の声)")
                        with gr.Row():
                            with gr.Column():
                                gemini_text = gr.Textbox(
                                    label="テキスト",
                                    placeholder="合成するテキストを入力...",
                                    lines=3,
                                )
                                gemini_voice = gr.Dropdown(
                                    choices=AVAILABLE_VOICES,
                                    value="Kore",
                                    label="声",
                                )
                                gemini_style = gr.Textbox(
                                    label="スタイル (任意)",
                                    placeholder="例: 明るく元気に / ささやくように / ゆっくり丁寧に",
                                )
                                gemini_btn = gr.Button("音声生成", variant="primary")
                            with gr.Column():
                                gemini_output = gr.Audio(label="生成された音声")

                        gemini_btn.click(
                            fn=synthesize_gemini,
                            inputs=[gemini_text, gemini_voice, gemini_style],
                            outputs=gemini_output,
                        )

                    with gr.TabItem("Edge TTS (APIキー不要)"):
                        gr.Markdown("### Edge TTS (無料・APIキー不要)")
                        with gr.Row():
                            with gr.Column():
                                edge_text = gr.Textbox(
                                    label="テキスト",
                                    placeholder="合成するテキストを入力...",
                                    lines=3,
                                )
                                edge_voices = {**JAPANESE_VOICES, **ENGLISH_VOICES}
                                edge_voice = gr.Dropdown(
                                    choices=list(edge_voices.keys()),
                                    value="nanami",
                                    label="声",
                                )
                                with gr.Row():
                                    edge_rate = gr.Textbox(
                                        value="+0%", label="速度",
                                    )
                                    edge_pitch = gr.Textbox(
                                        value="+0Hz", label="ピッチ",
                                    )
                                edge_btn = gr.Button("音声生成", variant="primary")
                            with gr.Column():
                                edge_output = gr.Audio(label="生成された音声")

                        edge_btn.click(
                            fn=synthesize_edge,
                            inputs=[edge_text, edge_voice, edge_rate, edge_pitch],
                            outputs=edge_output,
                        )

            # --- 音声変換タブ ---
            with gr.TabItem("音声変換 (Voice-to-Voice)"):
                gr.Markdown("### 音声 → 翻訳 → 音声合成 パイプライン")
                gr.Markdown("音声を別の言語に翻訳し、翻訳された音声を生成します。")
                with gr.Row():
                    with gr.Column():
                        v2v_audio = gr.Audio(
                            label="入力音声",
                            type="filepath",
                        )
                        with gr.Row():
                            v2v_src = gr.Dropdown(
                                choices=["japanese", "english", "chinese", "korean"],
                                value="japanese", label="元の言語",
                            )
                            v2v_tgt = gr.Dropdown(
                                choices=["english", "japanese", "chinese", "korean",
                                         "french", "german", "spanish"],
                                value="english", label="翻訳先",
                            )
                        v2v_voice = gr.Dropdown(
                            choices=AVAILABLE_VOICES,
                            value="Kore",
                            label="出力音声の声",
                        )
                        v2v_btn = gr.Button("変換実行", variant="primary")
                    with gr.Column():
                        v2v_trans = gr.Textbox(label="書き起こし (原文)", lines=2)
                        v2v_result = gr.Textbox(label="翻訳テキスト", lines=2)
                        v2v_output = gr.Audio(label="翻訳音声")

                v2v_btn.click(
                    fn=voice_to_voice,
                    inputs=[v2v_audio, v2v_src, v2v_tgt, v2v_voice],
                    outputs=[v2v_trans, v2v_result, v2v_output],
                )

    return demo


if __name__ == "__main__":
    if not api_key:
        print("警告: GOOGLE_API_KEY が未設定です。Gemini機能は使用できません。")
        print("  設定方法: export GOOGLE_API_KEY='your-api-key'")
        print()

    demo = build_ui()
    demo.launch(server_name="0.0.0.0", server_port=7860, theme=gr.themes.Soft())
