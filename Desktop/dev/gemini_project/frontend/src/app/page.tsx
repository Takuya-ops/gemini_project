"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type VideoSource = "youtube" | "drive";

type DriveFolder = {
  id: string;
  name: string;
};

type DriveVideo = {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
};

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [source, setSource] = useState<VideoSource>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [driveVideos, setDriveVideos] = useState<DriveVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<DriveVideo | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(
    "あなたは動画分析の専門家です。動画の内容を詳細に分析し、日本語で分かりやすくまとめてください。"
  );
  const [userPrompt, setUserPrompt] = useState(
    "この動画の内容を要約してください。主要なポイントを箇条書きでまとめてください。"
  );
  const [toEmail, setToEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("動画分析結果");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("session_id");
    if (stored) setSessionId(stored);
  }, []);

  const handleLogin = async () => {
    const res = await fetch(`${API_URL}/api/auth/login`);
    const data = await res.json();
    window.location.href = data.auth_url;
  };

  const handleLogout = () => {
    localStorage.removeItem("session_id");
    setSessionId(null);
    setResult(null);
  };

  const fetchFolders = async (parentId: string | null = null) => {
    if (!sessionId) return;
    setLoadingFolders(true);
    setError(null);
    try {
      const params = parentId ? `?parent_id=${parentId}` : "";
      const res = await fetch(`${API_URL}/api/drive/folders${params}`, {
        headers: { "X-Session-ID": sessionId },
      });
      if (!res.ok) {
        if (res.status === 401) { handleLogout(); return; }
        throw new Error("フォルダ一覧の取得に失敗しました");
      }
      const data = await res.json();
      setFolders(data.folders);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoadingFolders(false);
    }
  };

  const navigateToFolder = async (folder: DriveFolder | null) => {
    if (folder) {
      setFolderPath((prev) => [...prev, folder]);
      setSelectedFolderId(folder.id);
      fetchFolders(folder.id);
    } else {
      // ルートに戻る
      setFolderPath([]);
      setSelectedFolderId(null);
      fetchFolders(null);
    }
    setDriveVideos([]);
    setSelectedVideo(null);
  };

  const navigateBack = (index: number) => {
    if (index < 0) {
      navigateToFolder(null);
    } else {
      const target = folderPath[index];
      setFolderPath((prev) => prev.slice(0, index + 1));
      setSelectedFolderId(target.id);
      fetchFolders(target.id);
      setDriveVideos([]);
      setSelectedVideo(null);
    }
  };

  const fetchDriveVideos = async () => {
    if (!sessionId) return;
    setLoadingVideos(true);
    setError(null);
    try {
      const params = selectedFolderId ? `?folder_id=${selectedFolderId}` : "";
      const res = await fetch(`${API_URL}/api/drive/videos${params}`, {
        headers: { "X-Session-ID": sessionId },
      });
      if (!res.ok) {
        if (res.status === 401) { handleLogout(); return; }
        throw new Error("動画一覧の取得に失敗しました");
      }
      const data = await res.json();
      setDriveVideos(data.videos);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleAnalyze = async () => {
    if (!sessionId) return;
    if (source === "youtube" && !youtubeUrl) return;
    if (source === "drive" && !selectedVideo) return;
    if (!toEmail) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body =
        source === "youtube"
          ? {
              source: "youtube",
              youtube_url: youtubeUrl,
              system_prompt: systemPrompt,
              user_prompt: userPrompt,
              to_email: toEmail,
              email_subject: emailSubject,
            }
          : {
              source: "drive",
              file_id: selectedVideo!.id,
              file_name: selectedVideo!.name,
              system_prompt: systemPrompt,
              user_prompt: userPrompt,
              to_email: toEmail,
              email_subject: emailSubject,
            };

      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-ID": sessionId,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "分析に失敗しました");
      }
      const data = await res.json();
      setResult(data.analysis);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: string) => {
    const b = parseInt(bytes);
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const isReadyToAnalyze =
    !loading &&
    toEmail &&
    ((source === "youtube" && youtubeUrl) ||
      (source === "drive" && selectedVideo));

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-6 p-8">
          <h1 className="text-3xl font-bold">Video Analyzer</h1>
          <p className="text-gray-600">
            YouTube / Google Driveの動画をGemini AIで分析し、結果をメールで送信します
          </p>
          <button
            onClick={handleLogin}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Video Analyzer</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition"
        >
          ログアウト
        </button>
      </div>

      {/* Step 1: ソース選択 + 動画指定 */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">1. 動画ソースを選択</h2>

        {/* タブ */}
        <div className="flex border-b">
          <button
            onClick={() => setSource("youtube")}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
              source === "youtube"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            YouTube
          </button>
          <button
            onClick={() => setSource("drive")}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
              source === "drive"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Google Drive
          </button>
        </div>

        {/* YouTube入力 */}
        {source === "youtube" && (
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        )}

        {/* Google Drive */}
        {source === "drive" && (
          <div className="space-y-3">
            {/* フォルダ選択 */}
            <div className="flex gap-2">
              <button
                onClick={() => fetchFolders(selectedFolderId)}
                disabled={loadingFolders}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition disabled:opacity-50 text-sm"
              >
                {loadingFolders ? "読み込み中..." : "フォルダを表示"}
              </button>
              <button
                onClick={fetchDriveVideos}
                disabled={loadingVideos}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 text-sm"
              >
                {loadingVideos ? "読み込み中..." : "このフォルダの動画を取得"}
              </button>
            </div>

            {/* パンくずリスト */}
            {folderPath.length > 0 && (
              <div className="flex items-center gap-1 text-sm text-gray-600 flex-wrap">
                <button
                  onClick={() => navigateBack(-1)}
                  className="text-blue-600 hover:underline"
                >
                  マイドライブ
                </button>
                {folderPath.map((f, i) => (
                  <span key={f.id} className="flex items-center gap-1">
                    <span>/</span>
                    {i < folderPath.length - 1 ? (
                      <button
                        onClick={() => navigateBack(i)}
                        className="text-blue-600 hover:underline"
                      >
                        {f.name}
                      </button>
                    ) : (
                      <span className="font-medium text-gray-900">{f.name}</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* フォルダ一覧 */}
            {folders.length > 0 && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => navigateToFolder(f)}
                    className="w-full text-left p-3 hover:bg-yellow-50 transition flex items-center gap-2"
                  >
                    <span className="text-yellow-500">&#128193;</span>
                    <span className="font-medium">{f.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* 動画一覧 */}
            {driveVideos.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {driveVideos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVideo(v)}
                    className={`w-full text-left p-3 hover:bg-blue-50 transition ${
                      selectedVideo?.id === v.id ? "bg-blue-100" : ""
                    }`}
                  >
                    <div className="font-medium">{v.name}</div>
                    <div className="text-sm text-gray-500">
                      {formatSize(v.size)} ・{" "}
                      {new Date(v.modifiedTime).toLocaleDateString("ja-JP")}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedVideo && (
              <div className="text-sm text-blue-700 bg-blue-50 p-3 rounded">
                選択中: <strong>{selectedVideo.name}</strong>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 2: プロンプト設定 */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">2. 分析プロンプト設定</h2>
        <div>
          <label className="block text-sm font-medium mb-1">システムプロンプト</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ユーザープロンプト</label>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            rows={3}
            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </section>

      {/* Step 3: メール設定 */}
      <section className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">3. メール送信設定</h2>
        <div>
          <label className="block text-sm font-medium mb-1">送信先メールアドレス</label>
          <input
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="example@gmail.com"
            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">メール件名</label>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </section>

      {/* 実行ボタン */}
      <button
        onClick={handleAnalyze}
        disabled={!isReadyToAnalyze}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "分析中...（数分かかる場合があります）" : "分析を実行してメール送信"}
      </button>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* 結果表示 */}
      {result && (
        <section className="bg-white rounded-lg shadow p-6 space-y-2">
          <h2 className="text-lg font-semibold">分析結果</h2>
          <div className="text-sm text-green-700 bg-green-50 p-2 rounded">
            メール送信完了
          </div>
          <div className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg border">
            {result}
          </div>
        </section>
      )}
    </div>
  );
}
