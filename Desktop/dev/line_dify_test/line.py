import os, time, logging, requests
from pathlib import Path
from dotenv import load_dotenv

# .env を読み込む
load_dotenv()

# ログ設定
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)

# アクセストークン
TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN")
assert TOKEN, "環境変数 LINE_CHANNEL_ACCESS_TOKEN が読み込めていません"

# APIエンドポイント
API = "https://api.line.me/v2/bot"  # 通常API
API_DATA = "https://api-data.line.me/v2/bot"  # 画像アップロード専用

# 共通ヘッダ
HDR_JSON = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
HDR_AUTH = {"Authorization": f"Bearer {TOKEN}"}


def create_richmenu():
    """リッチメニューを作成"""
    body = {
        "size": {"width": 2500, "height": 843},
        "selected": True,
        "name": "sample-richmenu",
        "chatBarText": "メニュー",
        "areas": [
            {
                "bounds": {"x": 0, "y": 0, "width": 1250, "height": 843},
                "action": {"type": "message", "text": "ヘルプ"},
            },
            {
                "bounds": {"x": 1250, "y": 0, "width": 1250, "height": 843},
                "action": {
                    "type": "uri",
                    "uri": "https://dify.takuya-genai.com/chat/yhVboz5cYWdQ1U2q",
                },
            },
        ],
    }
    r = requests.post(f"{API}/richmenu", headers=HDR_JSON, json=body, timeout=30)
    logging.info("[create] %s %s", r.status_code, r.text)
    r.raise_for_status()
    rid = r.json()["richMenuId"]
    logging.info("richMenuId=%s", rid)
    return rid


def wait_gettable(richmenu_id: str, max_wait=60):
    """GET /richmenu/{id} が 200 を返すまで待つ"""
    url = f"{API}/richmenu/{richmenu_id}"
    t0 = time.time()
    delay = 1.0
    while time.time() - t0 < max_wait:
        r = requests.get(url, headers=HDR_AUTH, timeout=15)
        logging.info("[wait_gettable] %s", r.status_code)
        if r.status_code == 200:
            return True
        time.sleep(delay)
        delay = min(delay * 1.5, 8.0)
    logging.warning("GET readiness timeout (> %ss)", max_wait)
    return False


def upload_image(richmenu_id: str, path: str):
    """リッチメニュー画像をアップロード"""
    p = Path(path)
    assert p.exists(), f"画像ファイルが見つかりません: {p.resolve()}"
    data = p.read_bytes()
    if len(data) > 1_000_000:
        logging.warning("画像が1MB超です（%d bytes）。圧縮推奨。", len(data))
    ctype = "image/jpeg" if p.suffix.lower() in (".jpg", ".jpeg") else "image/png"
    url = f"{API_DATA}/richmenu/{richmenu_id}/content"  # ← 画像アップロードは api-data
    headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": ctype}

    backoff = 1.0
    for attempt in range(1, 8):  # 最大 ~90秒
        r = requests.post(url, headers=headers, data=data, timeout=60)
        logging.info("[upload #%d] %s %s", attempt, r.status_code, r.text[:200])
        if r.ok:
            logging.info("upload success (%d bytes, %s)", len(data), ctype)
            return
        # 作成直後などで 404 が継続するケースにリトライ
        if r.status_code in (404, 409, 425):
            time.sleep(backoff)
            backoff = min(backoff * 1.7, 15.0)
            continue
        r.raise_for_status()
    raise RuntimeError("upload_image: retried but still 404/4xx")


def set_default(richmenu_id: str):
    """作成したリッチメニューをデフォルトに設定"""
    r = requests.post(
        f"{API}/user/all/richmenu/{richmenu_id}", headers=HDR_AUTH, timeout=30
    )
    logging.info("[set_default] %s %s", r.status_code, r.text)
    r.raise_for_status()


if __name__ == "__main__":
    rid = create_richmenu()
    # ← まず GET で参照できるまで待つ
    wait_gettable(rid, max_wait=60)
    upload_image(rid, "./richmenu.jpg")
    set_default(rid)
    logging.info("DONE")
