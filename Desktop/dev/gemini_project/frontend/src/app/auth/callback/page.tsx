"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setStatus("error");
      setErrorMsg("認証パラメータが不足しています");
      return;
    }

    fetch(`${API_URL}/api/auth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("認証に失敗しました");
        return res.json();
      })
      .then((data) => {
        localStorage.setItem("session_id", data.session_id);
        setStatus("success");
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      })
      .catch((e) => {
        setStatus("error");
        setErrorMsg(e.message);
      });
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4 p-8">
        {status === "loading" && (
          <>
            <div className="text-xl font-semibold">認証処理中...</div>
            <div className="text-gray-500">しばらくお待ちください</div>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-xl font-semibold text-green-600">
              認証成功
            </div>
            <div className="text-gray-500">リダイレクトしています...</div>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-xl font-semibold text-red-600">
              認証エラー
            </div>
            <div className="text-gray-500">{errorMsg}</div>
            <a href="/" className="text-blue-600 underline">
              トップに戻る
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">読み込み中...</div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
