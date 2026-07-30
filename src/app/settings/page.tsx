"use client";

import {useEffect, useState} from "react";

export default function SettingsPage() {
  const [value, setValue] = useState(0.5);
  const [status, setStatus] = useState("");
  useEffect(() => { fetch("/api/settings").then((response) => response.json()).then((data) =>
    setValue(data.defaultBlockEndHoldSeconds)); }, []);
  const save = async () => {
    setStatus("保存中…");
    await fetch("/api/settings", {
      method: "PUT", headers: {"content-type": "application/json"},
      body: JSON.stringify({defaultBlockEndHoldSeconds: value}),
    });
    setStatus("保存済み");
  };
  return (
    <div className="page narrow">
      <div className="page-heading"><div><p className="eyebrow">SETTINGS</p><h1>設定</h1></div></div>
      <section className="panel settings-panel">
        <label>コンテンツ末尾の既定余白
          <span><input type="number" min="0" step="0.1" value={value} onChange={(event) => setValue(Number(event.target.value))} /> 秒</span>
        </label>
        <p className="hint">ブロックで個別指定がない場合に使われます。</p>
        <button className="primary" onClick={save}>保存</button> <span>{status}</span>
      </section>
    </div>
  );
}
