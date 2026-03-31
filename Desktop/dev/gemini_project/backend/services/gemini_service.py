import os
import time
import google.generativeai as genai
from config import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)


def _get_model(system_prompt: str):
    return genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system_prompt,
    )


def analyze_youtube_video(
    youtube_url: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    model = _get_model(system_prompt)
    response = model.generate_content(
        [user_prompt, youtube_url],
        request_options={"timeout": 600},
    )
    return response.text


def analyze_drive_video(
    video_path: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    model = _get_model(system_prompt)

    video_file = genai.upload_file(path=video_path)

    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = genai.get_file(video_file.name)

    if video_file.state.name == "FAILED":
        raise RuntimeError(f"動画のアップロードに失敗しました: {video_file.state.name}")

    response = model.generate_content(
        [video_file, user_prompt],
        request_options={"timeout": 600},
    )

    os.unlink(video_path)
    genai.delete_file(video_file.name)

    return response.text
