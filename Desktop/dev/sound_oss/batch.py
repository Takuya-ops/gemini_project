"""バッチ処理 - 複数ファイルの一括音声認識・音声合成

使用例:
  # フォルダ内の全音声を一括書き起こし
  python batch.py asr ./audio_files/ -o results.json

  # テキストファイルから一括音声合成
  python batch.py tts sentences.txt -o ./output_audio/

  # CSV/TSVから一括処理 (1列目: ファイル名, 2列目以降: テキスト)
  python batch.py asr ./audio_files/ -o results.csv --format csv
"""

import argparse
import csv
import json
import os
import time
from pathlib import Path


AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aiff"}


def batch_asr(input_dir: str, output_path: str, language: str,
              api_model: str, output_format: str, api_key: str | None):
    """フォルダ内の音声ファイルを一括書き起こし"""
    from gemma4_api import GeminiApiASR

    asr = GeminiApiASR(model_name=api_model, api_key=api_key)
    input_path = Path(input_dir)

    if not input_path.is_dir():
        print(f"エラー: {input_dir} はディレクトリではありません")
        return

    audio_files = sorted(
        f for f in input_path.iterdir()
        if f.suffix.lower() in AUDIO_EXTENSIONS
    )

    if not audio_files:
        print(f"エラー: {input_dir} に音声ファイルが見つかりません")
        return

    print(f"対象ファイル: {len(audio_files)} 件")
    print()

    results = []
    for i, audio_file in enumerate(audio_files, 1):
        print(f"[{i}/{len(audio_files)}] {audio_file.name}")
        try:
            text = asr.transcribe(str(audio_file), language=language)
            results.append({
                "file": audio_file.name,
                "transcription": text,
                "status": "ok",
            })
            print(f"  → {text[:80]}{'...' if len(text) > 80 else ''}")
        except Exception as e:
            results.append({
                "file": audio_file.name,
                "transcription": "",
                "status": f"error: {e}",
            })
            print(f"  → エラー: {e}")

        # レート制限を考慮
        if i < len(audio_files):
            time.sleep(1)

    # 結果出力
    output = Path(output_path)
    if output_format == "json":
        output.write_text(
            json.dumps(results, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    elif output_format == "csv":
        with open(output, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["file", "transcription", "status"])
            writer.writeheader()
            writer.writerows(results)
    else:
        # テキスト
        lines = [f"{r['file']}\t{r['transcription']}" for r in results]
        output.write_text("\n".join(lines), encoding="utf-8")

    ok_count = sum(1 for r in results if r["status"] == "ok")
    print(f"\n完了: {ok_count}/{len(results)} 件成功 → {output_path}")


def batch_tts(input_file: str, output_dir: str, engine: str,
              voice: str, api_key: str | None):
    """テキストファイルから一括音声合成 (1行 = 1音声ファイル)"""
    input_path = Path(input_file)
    if not input_path.is_file():
        print(f"エラー: {input_file} が見つかりません")
        return

    lines = [
        line.strip() for line in input_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    if not lines:
        print("エラー: テキストファイルが空です")
        return

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"対象テキスト: {len(lines)} 行")
    print(f"出力先: {out_dir}")
    print()

    if engine == "gemini":
        from tts_gemini import GeminiTTS
        tts = GeminiTTS(api_key=api_key)
        ext = ".wav"
    else:
        from tts_edge import EdgeTTS
        tts = EdgeTTS(voice=voice)
        ext = ".mp3"

    success = 0
    for i, text in enumerate(lines, 1):
        output_path = out_dir / f"{i:04d}{ext}"
        print(f"[{i}/{len(lines)}] {text[:60]}{'...' if len(text) > 60 else ''}")
        try:
            tts.synthesize(text=text, output_path=str(output_path))
            success += 1
        except Exception as e:
            print(f"  → エラー: {e}")

        if engine == "gemini" and i < len(lines):
            time.sleep(2)

    print(f"\n完了: {success}/{len(lines)} 件生成 → {out_dir}/")


def batch_translate(input_dir: str, output_path: str, source_lang: str,
                    target_lang: str, api_model: str, api_key: str | None):
    """フォルダ内の音声ファイルを一括翻訳"""
    from gemma4_api import GeminiApiASR

    asr = GeminiApiASR(model_name=api_model, api_key=api_key)
    input_path = Path(input_dir)

    audio_files = sorted(
        f for f in input_path.iterdir()
        if f.suffix.lower() in AUDIO_EXTENSIONS
    )

    if not audio_files:
        print(f"エラー: {input_dir} に音声ファイルが見つかりません")
        return

    print(f"対象ファイル: {len(audio_files)} 件 ({source_lang} → {target_lang})")
    print()

    results = []
    for i, audio_file in enumerate(audio_files, 1):
        print(f"[{i}/{len(audio_files)}] {audio_file.name}")
        try:
            result = asr.translate(
                str(audio_file), source_lang, target_lang
            )
            results.append({
                "file": audio_file.name,
                "transcription": result["transcription"],
                "translation": result["translation"],
                "status": "ok",
            })
            print(f"  原文: {result['transcription'][:60]}")
            print(f"  翻訳: {result['translation'][:60]}")
        except Exception as e:
            results.append({
                "file": audio_file.name,
                "transcription": "",
                "translation": "",
                "status": f"error: {e}",
            })
            print(f"  → エラー: {e}")

        if i < len(audio_files):
            time.sleep(1)

    output = Path(output_path)
    output.write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    ok_count = sum(1 for r in results if r["status"] == "ok")
    print(f"\n完了: {ok_count}/{len(results)} 件成功 → {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="バッチ処理 - 一括音声認識・音声合成",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--api-key", help="Google AI Studio APIキー")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # --- batch ASR ---
    asr_p = subparsers.add_parser("asr", help="一括音声認識")
    asr_p.add_argument("input_dir", help="音声ファイルのディレクトリ")
    asr_p.add_argument("-o", "--output", default="results.json", help="出力ファイル")
    asr_p.add_argument("--language", default="japanese")
    asr_p.add_argument("--api-model", default="gemini-2.5-flash")
    asr_p.add_argument("--format", choices=["json", "csv", "txt"], default="json")

    # --- batch TTS ---
    tts_p = subparsers.add_parser("tts", help="一括音声合成")
    tts_p.add_argument("input_file", help="テキストファイル (1行=1音声)")
    tts_p.add_argument("-o", "--output-dir", default="./output_audio", help="出力ディレクトリ")
    tts_p.add_argument("--engine", choices=["gemini", "edge"], default="gemini")
    tts_p.add_argument("--voice", default="Kore", help="声の名前")

    # --- batch translate ---
    trans_p = subparsers.add_parser("translate", help="一括音声翻訳")
    trans_p.add_argument("input_dir", help="音声ファイルのディレクトリ")
    trans_p.add_argument("-o", "--output", default="translations.json")
    trans_p.add_argument("--source-language", default="japanese")
    trans_p.add_argument("--target-language", default="english")
    trans_p.add_argument("--api-model", default="gemini-2.5-flash")

    args = parser.parse_args()

    if args.command == "asr":
        batch_asr(args.input_dir, args.output, args.language,
                  args.api_model, args.format, args.api_key)
    elif args.command == "tts":
        batch_tts(args.input_file, args.output_dir, args.engine,
                  args.voice, args.api_key)
    elif args.command == "translate":
        batch_translate(args.input_dir, args.output, args.source_language,
                        args.target_language, args.api_model, args.api_key)


if __name__ == "__main__":
    main()
