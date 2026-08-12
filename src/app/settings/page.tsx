"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MoraAccentEditor } from "@/components/MoraAccentEditor";
import {
  VOICEVOX_WORD_TYPES,
  splitVoicevoxMoras,
  voicevoxPartOfSpeechLabel,
  voicevoxWordTypeFromWord,
  type VoicevoxUserDict,
  type VoicevoxUserDictWord,
  type VoicevoxWordType,
} from "@/domain/voicevox-user-dict";

type WordRow = VoicevoxUserDictWord & { id: string };

const initialForm = {
  surface: "",
  pronunciation: "",
  wordType: "PROPER_NOUN" as VoicevoxWordType,
  accentType: 0,
};

export default function SettingsPage() {
  const [words, setWords] = useState<WordRow[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [moras, setMoras] = useState<string[]>([]);
  const [moraError, setMoraError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const formSectionRef = useRef<HTMLElement>(null);

  const loadWords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/voicevox/user-dict", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const dictionary = (await response.json()) as VoicevoxUserDict;
      setWords(
        Object.entries(dictionary)
          .map(([id, word]) => ({ id, ...word }))
          .sort((left, right) => left.surface.localeCompare(right.surface, "ja")),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ユーザー辞書を取得できませんでした");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  const analyzePronunciation = () => {
    const pronunciation = form.pronunciation.trim();
    if (!pronunciation) {
      setMoras([]);
      setMoraError("");
      return;
    }

    const nextMoras = splitVoicevoxMoras(pronunciation);
    if (nextMoras.length === 0) {
      setMoras([]);
      setMoraError("読みは有効な全角カタカナで入力してください");
      return;
    }

    setMoras(nextMoras);
    setMoraError("");
    setForm((current) => ({
      ...current,
      pronunciation,
      accentType: Math.min(current.accentType, nextMoras.length),
    }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setMoras([]);
    setMoraError("");
    setEditingId(null);
  };

  const startEditing = (word: WordRow) => {
    const nextMoras = splitVoicevoxMoras(word.pronunciation);
    setForm({
      surface: word.surface,
      pronunciation: word.pronunciation,
      wordType: voicevoxWordTypeFromWord(word),
      accentType: word.accent_type,
    });
    setMoras(nextMoras);
    setMoraError("");
    setEditingId(word.id);
    setError("");
    setNotice("");
    requestAnimationFrame(() => formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const deleteWord = async (word: WordRow) => {
    if (!window.confirm(`「${word.surface}」をユーザー辞書から削除しますか？`)) return;
    setDeletingId(word.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/voicevox/user-dict/${encodeURIComponent(word.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response));
      if (editingId === word.id) resetForm();
      await loadWords();
      setNotice(`「${word.surface}」を削除しました`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ユーザー辞書から削除できませんでした");
    } finally {
      setDeletingId(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const submittedMoras = splitVoicevoxMoras(form.pronunciation.trim());
    if (submittedMoras.length === 0) {
      setMoras([]);
      setMoraError("読みは有効な全角カタカナで入力してください");
      setError("読みを確認してください");
      return;
    }
    if (form.accentType < 0 || form.accentType > submittedMoras.length) {
      setError(`アクセント位置は0〜${submittedMoras.length}で指定してください`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        editingId ? `/api/voicevox/user-dict/${encodeURIComponent(editingId)}` : "/api/voicevox/user-dict",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            surface: form.surface,
            pronunciation: form.pronunciation,
            wordType: form.wordType,
            accentType: form.accentType,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));
      const wasEditing = editingId !== null;
      resetForm();
      await loadWords();
      setNotice(wasEditing ? "ユーザー辞書を更新しました" : "ユーザー辞書へ登録しました");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : editingId
            ? "ユーザー辞書を更新できませんでした"
            : "ユーザー辞書へ登録できませんでした",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h1>設定</h1>
          <p className="muted">エディター全体で利用する設定を管理します。</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert settings-success">{notice}</div>}

      <section className="settings-card" ref={formSectionRef}>
        <div className="settings-card-heading dictionary-editor-heading">
          <div>
            <h2>{editingId ? "ユーザー辞書を編集" : "VOICEVOX ユーザー辞書"}</h2>
            <p className="muted">
              {editingId
                ? "単語の表記、読み、品詞、アクセントを更新します。"
                : "固有の名称や読み方をVOICEVOXへ登録します。"}
            </p>
          </div>
          {editingId && (
            <button className="secondary" type="button" onClick={resetForm} disabled={submitting}>
              編集をキャンセル
            </button>
          )}
        </div>

        <form className="dictionary-form" onSubmit={submit}>
          <label>
            表記
            <input
              required
              value={form.surface}
              placeholder="例：製作日誌"
              onChange={(event) => setForm((current) => ({ ...current, surface: event.target.value }))}
            />
          </label>
          <label>
            読み
            <input
              required
              value={form.pronunciation}
              placeholder="例：セイサクニッシ"
              onChange={(event) => {
                setForm((current) => ({ ...current, pronunciation: event.target.value }));
                setMoras([]);
                setMoraError("");
              }}
              onBlur={analyzePronunciation}
            />
            <small className={moraError ? "field-error" : ""}>
              {moraError || "カタカナで入力し、フォーカスを外すとモーラへ分割します。"}
            </small>
          </label>
          <label>
            品詞
            <select
              value={form.wordType}
              onChange={(event) =>
                setForm((current) => ({ ...current, wordType: event.target.value as VoicevoxWordType }))
              }
            >
              {VOICEVOX_WORD_TYPES.map((wordType) => (
                <option key={wordType.value} value={wordType.value}>
                  {wordType.label}
                </option>
              ))}
            </select>
          </label>
          {moras.length > 0 ? (
            <MoraAccentEditor
              moras={moras}
              accentType={form.accentType}
              onChange={(accentType) => setForm((current) => ({ ...current, accentType }))}
            />
          ) : (
            <div className="accent-editor-empty">
              <strong>アクセント位置</strong>
              <span>読みを入力してフォーカスを外すと、アクセントを選択できます。</span>
            </div>
          )}
          <div className="dictionary-form-actions">
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? (editingId ? "更新中…" : "登録中…") : editingId ? "変更を保存" : "辞書へ登録"}
            </button>
          </div>
        </form>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading dictionary-list-heading">
          <div>
            <h2>登録済みの単語</h2>
            <p className="muted">VOICEVOXに現在保存されているユーザー辞書です。</p>
          </div>
          <button className="secondary" type="button" onClick={() => void loadWords()} disabled={loading}>
            {loading ? "更新中…" : "再読み込み"}
          </button>
        </div>

        {loading ? (
          <div className="dictionary-state">読み込み中…</div>
        ) : words.length === 0 ? (
          <div className="empty-state">登録済みの単語はありません。</div>
        ) : (
          <div className="dictionary-table-wrap">
            <table className="dictionary-table">
              <thead>
                <tr>
                  <th>表記</th>
                  <th>読み</th>
                  <th>品詞</th>
                  <th>アクセント型</th>
                  <th className="dictionary-actions-heading">操作</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id} className={editingId === word.id ? "editing" : ""}>
                    <td>{word.surface}</td>
                    <td>{word.pronunciation}</td>
                    <td>{voicevoxPartOfSpeechLabel(word)}</td>
                    <td>
                      {word.accent_type}
                      {word.mora_count !== undefined && <small> / {word.mora_count}モーラ</small>}
                    </td>
                    <td>
                      <div className="dictionary-row-actions">
                        <button type="button" className="dictionary-edit-button" onClick={() => startEditing(word)}>
                          編集
                        </button>
                        <button
                          type="button"
                          className="dictionary-delete-button"
                          disabled={deletingId === word.id}
                          onClick={() => void deleteWord(word)}
                        >
                          {deletingId === word.id ? "削除中…" : "削除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `リクエストに失敗しました（${response.status}）`;
}
