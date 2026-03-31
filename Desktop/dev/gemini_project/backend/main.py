from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

import config
from services.drive_service import list_folders, list_video_files, download_video
from services.gemini_service import analyze_youtube_video, analyze_drive_video
from services.gmail_service import send_email

app = FastAPI(title="Video Analyzer API")

allowed_origins = [config.FRONTEND_URL]
if config.FRONTEND_URL != "http://localhost:3000":
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# インメモリのトークンストア（本番ではRedis等を使用）
token_store: dict[str, dict] = {}


def _get_flow(redirect_uri: str) -> Flow:
    client_config = {
        "web": {
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    return Flow.from_client_config(
        client_config,
        scopes=config.SCOPES,
        redirect_uri=redirect_uri,
    )


def _get_credentials(session_id: str) -> Credentials:
    token_data = token_store.get(session_id)
    if not token_data:
        raise HTTPException(status_code=401, detail="未認証です。ログインしてください。")
    return Credentials(
        token=token_data["token"],
        refresh_token=token_data.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=config.GOOGLE_CLIENT_ID,
        client_secret=config.GOOGLE_CLIENT_SECRET,
        scopes=config.SCOPES,
    )


# --- Auth Endpoints ---

@app.get("/api/auth/login")
def auth_login(request: Request):
    redirect_uri = f"{config.FRONTEND_URL}/auth/callback"
    flow = _get_flow(redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return {"auth_url": auth_url, "state": state}


class TokenRequest(BaseModel):
    code: str
    state: str


@app.post("/api/auth/callback")
def auth_callback(req: TokenRequest):
    redirect_uri = f"{config.FRONTEND_URL}/auth/callback"
    flow = _get_flow(redirect_uri)
    flow.fetch_token(code=req.code)
    credentials = flow.credentials

    import secrets
    session_id = secrets.token_urlsafe(32)
    token_store[session_id] = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
    }
    return {"session_id": session_id}


@app.get("/api/auth/status")
def auth_status(request: Request):
    session_id = request.headers.get("X-Session-ID")
    if not session_id or session_id not in token_store:
        return {"authenticated": False}
    return {"authenticated": True}


# --- Drive Endpoints ---

@app.get("/api/drive/folders")
def get_folders(request: Request, parent_id: str | None = None):
    session_id = request.headers.get("X-Session-ID")
    credentials = _get_credentials(session_id)
    folders = list_folders(credentials, parent_id)
    return {"folders": folders}


@app.get("/api/drive/videos")
def get_videos(request: Request, folder_id: str | None = None):
    session_id = request.headers.get("X-Session-ID")
    credentials = _get_credentials(session_id)
    videos = list_video_files(credentials, folder_id)
    return {"videos": videos}


# --- Analyze Endpoint ---

class AnalyzeRequest(BaseModel):
    source: str  # "youtube" or "drive"
    youtube_url: Optional[str] = None
    file_id: Optional[str] = None
    file_name: Optional[str] = None
    system_prompt: str
    user_prompt: str
    to_email: str
    email_subject: str


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest, request: Request):
    session_id = request.headers.get("X-Session-ID")
    credentials = _get_credentials(session_id)

    # 1. 動画を分析
    try:
        if req.source == "youtube":
            if not req.youtube_url:
                raise ValueError("YouTube URLが指定されていません")
            analysis_result = analyze_youtube_video(
                youtube_url=req.youtube_url,
                system_prompt=req.system_prompt,
                user_prompt=req.user_prompt,
            )
            video_label = f"YouTube動画: {req.youtube_url}"
        elif req.source == "drive":
            if not req.file_id:
                raise ValueError("Google Driveファイルが選択されていません")
            video_path = download_video(credentials, req.file_id)
            analysis_result = analyze_drive_video(
                video_path=video_path,
                system_prompt=req.system_prompt,
                user_prompt=req.user_prompt,
            )
            video_label = f"Google Drive動画: {req.file_name or req.file_id}"
        else:
            raise ValueError("無効なソースです")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"動画分析エラー: {e}")

    # 2. Gmail で結果を送信
    try:
        email_body = f"{video_label} の分析結果:\n\n{analysis_result}"
        result = send_email(
            credentials=credentials,
            to=req.to_email,
            subject=req.email_subject,
            body=email_body,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"メール送信エラー: {e}")

    return {
        "analysis": analysis_result,
        "email": result,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
