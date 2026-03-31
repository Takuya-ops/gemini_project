import io
import tempfile
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials


def get_drive_service(credentials: Credentials):
    return build("drive", "v3", credentials=credentials)


def list_folders(credentials: Credentials, parent_id: str | None = None) -> list[dict]:
    service = get_drive_service(credentials)
    query = "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    results = service.files().list(
        q=query,
        fields="files(id, name)",
        orderBy="name",
        pageSize=100,
    ).execute()
    return results.get("files", [])


def list_video_files(credentials: Credentials, folder_id: str | None = None) -> list[dict]:
    service = get_drive_service(credentials)
    query = "mimeType contains 'video/' and trashed = false"
    if folder_id:
        query += f" and '{folder_id}' in parents"
    results = service.files().list(
        q=query,
        fields="files(id, name, mimeType, size, modifiedTime)",
        orderBy="modifiedTime desc",
        pageSize=50,
    ).execute()
    return results.get("files", [])


def download_video(credentials: Credentials, file_id: str) -> str:
    service = get_drive_service(credentials)

    file_meta = service.files().get(fileId=file_id, fields="name,mimeType,size").execute()
    size = int(file_meta.get("size", 0))
    max_size = 2 * 1024 * 1024 * 1024  # 2GB
    if size > max_size:
        raise ValueError(f"ファイルサイズが大きすぎます: {size} bytes (上限: 2GB)")

    request = service.files().get_media(fileId=file_id)
    suffix = _get_suffix(file_meta.get("mimeType", ""))
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)

    downloader = MediaIoBaseDownload(io.FileIO(tmp.name, "wb"), request)
    done = False
    while not done:
        _, done = downloader.next_chunk()

    return tmp.name


def _get_suffix(mime_type: str) -> str:
    mapping = {
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "video/webm": ".webm",
    }
    return mapping.get(mime_type, ".mp4")
