"use client";

import {useState} from "react";

export function GeminiButton({onGenerate}: {onGenerate: (memo: string) => Promise<void>}) {
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState("");
  const [state, setState] = useState("");

  const run = async () => {
    setState("生成中…");
    try {
      await onGenerate(memo);
      setMemo("");
      setOpen(false);
      setState("");
    } catch (error) {
      setState(error instanceof Error ? error.message : "生成に失敗しました");
    }
  };

  if (!open) {
    return (
      <button className="gemini-button" onClick={() => setOpen(true)}>
        ✦ メモから会話を追加
      </button>
    );
  }

  return (
    <div className="gemini-box">
      <textarea
        autoFocus
        placeholder="今日やったことをざっくり入力"
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
      />
      <button className="primary" disabled={!memo || state === "生成中…"} onClick={run}>
        追加
      </button>
      <button className="secondary" onClick={() => setOpen(false)}>
        閉じる
      </button>
      {state ? <span>{state}</span> : null}
    </div>
  );
}
