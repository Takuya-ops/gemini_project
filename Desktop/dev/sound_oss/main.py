"""音声認識・音声合成 CLI

=== 音声認識 (ASR) ===
  python main.py asr audio.wav
  python main.py asr audio.wav --mode local
  python main.py asr audio.wav --translate --target-language english

=== 音声合成 (TTS) ===
  python main.py tts "こんにちは" -o hello.wav
  python main.py tts "こんにちは" --engine edge -o hello.mp3
  python main.py tts "こんにちは" --voice Aoede --style "ささやくように"

=== 対話音声合成 ===
  python main.py dialogue "太郎: おはよう\\n花子: おはようございます" -o chat.wav
"""

import argparse
import json


def cmd_asr(args):
    """音声認識コマンド"""
    if args.mode == "api":
        from gemma4_api import GeminiApiASR
        asr = GeminiApiASR(model_name=args.api_model, api_key=args.api_key)
    else:
        from gemma4_local import Gemma4LocalASR
        asr = Gemma4LocalASR(model_size=args.local_model)

    if args.translate:
        result = asr.translate(
            audio_path=args.audio_path,
            source_language=args.language,
            target_language=args.target_language,
        )
        if args.output_json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            print(f"\n[書き起こし] {result['transcription']}")
            print(f"[翻訳 ({args.target_language})] {result['translation']}")
    else:
        text = asr.transcribe(
            audio_path=args.audio_path,
            language=args.language,
        )
        if args.output_json:
            print(json.dumps({"transcription": text}, ensure_ascii=False, indent=2))
        else:
            print(f"\n[書き起こし] {text}")


def cmd_tts(args):
    """音声合成コマンド"""
    if args.engine == "gemini":
        from tts_gemini import GeminiTTS
        tts = GeminiTTS(api_key=args.api_key)
        tts.synthesize(
            text=args.text,
            output_path=args.output,
            voice=args.voice,
            style=args.style,
        )
    else:
        from tts_edge import EdgeTTS
        tts = EdgeTTS(voice=args.voice_edge)
        tts.synthesize(
            text=args.text,
            output_path=args.output,
            rate=args.rate,
            pitch=args.pitch,
        )


def cmd_dialogue(args):
    """対話音声合成コマンド"""
    from tts_gemini import GeminiTTS
    tts = GeminiTTS(api_key=args.api_key)

    speakers = {}
    if args.speakers:
        for pair in args.speakers:
            name, voice = pair.split("=")
            speakers[name] = voice

    script = args.script.replace("\\n", "\n")
    tts.synthesize_dialogue(
        script=script,
        output_path=args.output,
        speakers=speakers,
    )


def main():
    parser = argparse.ArgumentParser(
        description="音声認識・音声合成 CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--api-key",
        help="Google AI Studio APIキー (未指定時は環境変数 GOOGLE_API_KEY)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # --- ASR サブコマンド ---
    asr_parser = subparsers.add_parser("asr", help="音声認識 (ASR)")
    asr_parser.add_argument("audio_path", help="音声ファイルのパス")
    asr_parser.add_argument(
        "--mode", choices=["api", "local"], default="api",
        help="api (Gemini) / local (Gemma 4) (default: api)",
    )
    asr_parser.add_argument(
        "--api-model",
        choices=["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
        default="gemini-2.5-flash",
    )
    asr_parser.add_argument(
        "--local-model", choices=["e4b", "e2b"], default="e4b",
    )
    asr_parser.add_argument("--language", default="japanese")
    asr_parser.add_argument("--translate", action="store_true")
    asr_parser.add_argument("--target-language", default="english")
    asr_parser.add_argument("--json", action="store_true", dest="output_json")
    asr_parser.set_defaults(func=cmd_asr)

    # --- TTS サブコマンド ---
    tts_parser = subparsers.add_parser("tts", help="音声合成 (TTS)")
    tts_parser.add_argument("text", help="合成するテキスト")
    tts_parser.add_argument(
        "--engine", choices=["gemini", "edge"], default="gemini",
        help="TTSエンジン (default: gemini)",
    )
    tts_parser.add_argument(
        "-o", "--output", default="output.wav",
        help="出力ファイルパス (default: output.wav)",
    )
    # Gemini TTS オプション
    tts_parser.add_argument(
        "--voice", default="Kore",
        help="Gemini声の名前 (default: Kore)",
    )
    tts_parser.add_argument(
        "--style", default=None,
        help="スタイル指定 (例: '明るく元気に', 'ささやくように')",
    )
    # Edge TTS オプション
    tts_parser.add_argument(
        "--voice-edge", default="nanami",
        help="Edge TTS声 (default: nanami) [nanami/keita/aria/guy 等]",
    )
    tts_parser.add_argument("--rate", default="+0%", help="速度 (例: +20%%)")
    tts_parser.add_argument("--pitch", default="+0Hz", help="ピッチ (例: +5Hz)")
    tts_parser.set_defaults(func=cmd_tts)

    # --- Dialogue サブコマンド ---
    dlg_parser = subparsers.add_parser("dialogue", help="対話音声合成")
    dlg_parser.add_argument("script", help="対話スクリプト (例: '太郎: こんにちは\\n花子: こんにちは')")
    dlg_parser.add_argument(
        "-o", "--output", default="dialogue.wav",
        help="出力ファイルパス (default: dialogue.wav)",
    )
    dlg_parser.add_argument(
        "--speakers", nargs="*",
        help="スピーカー=声 のマッピング (例: 太郎=Kore 花子=Aoede)",
    )
    dlg_parser.set_defaults(func=cmd_dialogue)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
