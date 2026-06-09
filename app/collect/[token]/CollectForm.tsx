"use client";

import { useEffect, useState } from "react";

interface ResolveData {
  mode: "PERSON_UPDATE" | "ADD_CHILD";
  note: string | null;
  family: { name: string; surname: string };
  person: {
    id: string;
    name: string;
    generation: number;
    generationChar: string | null;
    current: {
      name: string;
      alias: string | null;
      birthYear: number | null;
      deathYear: number | null;
      birthPlace: string | null;
      status: string;
      note: string | null;
    } | null;
  };
}

const STATUS_OPTIONS = [
  { v: "ALIVE", label: "在世" },
  { v: "DECEASED", label: "已故" },
  { v: "LOST", label: "失联" },
  { v: "UNKNOWN", label: "不详" },
];

export function CollectForm({ token }: { token: string }) {
  const [data, setData] = useState<ResolveData | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 表单字段
  const [fields, setFields] = useState<Record<string, string>>({});
  const [contributor, setContributor] = useState({ name: "", phone: "", relation: "" });

  useEffect(() => {
    fetch(`/api/collect/${token}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) {
          setLoadErr(j?.error?.message ?? "采集链接无效");
          return;
        }
        const d: ResolveData = j.data;
        setData(d);
        if (d.mode === "PERSON_UPDATE" && d.person.current) {
          const c = d.person.current;
          setFields({
            name: c.name ?? "",
            alias: c.alias ?? "",
            birthYear: c.birthYear?.toString() ?? "",
            deathYear: c.deathYear?.toString() ?? "",
            birthPlace: c.birthPlace ?? "",
            status: c.status ?? "ALIVE",
            note: c.note ?? "",
            phone: "",
          });
        } else {
          setFields({ name: "", gender: "MALE", birthYear: "", birthPlace: "", note: "" });
        }
      })
      .catch(() => setLoadErr("网络错误，请重试"))
      .finally(() => setLoading(false));
  }, [token]);

  function set(k: string, v: string) {
    setFields((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    if (!data) return;
    setErr(null);
    if (!contributor.name.trim()) {
      setErr("请填写您的姓名");
      return;
    }
    setSubmitting(true);
    try {
      let body: unknown;
      if (data.mode === "PERSON_UPDATE") {
        body = {
          contributor,
          phone: fields.phone || undefined,
          changes: {
            name: fields.name,
            alias: fields.alias,
            birthYear: fields.birthYear ? Number(fields.birthYear) : "",
            deathYear: fields.deathYear ? Number(fields.deathYear) : "",
            birthPlace: fields.birthPlace,
            status: fields.status,
            note: fields.note,
          },
        };
      } else {
        if (!fields.name.trim()) {
          setErr("请填写子女姓名");
          setSubmitting(false);
          return;
        }
        body = {
          contributor,
          child: {
            name: fields.name,
            gender: fields.gender || "MALE",
            birthYear: fields.birthYear ? Number(fields.birthYear) : null,
            birthPlace: fields.birthPlace || null,
            note: fields.note || null,
          },
        };
      }
      const r = await fetch(`/api/collect/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setErr(j?.error?.message ?? "提交失败");
        return;
      }
      setDone(true);
    } catch {
      setErr("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Card><p className="py-8 text-center text-sm text-fg-muted">加载中…</p></Card>;
  }
  if (loadErr || !data) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">{loadErr ?? "链接无效"}</p>
      </Card>
    );
  }
  if (done) {
    return (
      <Card>
        <div className="py-8 text-center">
          <div className="text-3xl">✅</div>
          <p className="mt-3 text-base font-medium">提交成功</p>
          <p className="mt-1 text-sm text-fg-muted">
            已送交「{data.family.name}」族长 / 管理员审核，通过后将录入家谱。感谢您的参与！
          </p>
          {data.mode === "ADD_CHILD" ? (
            <button
              type="button"
              onClick={() => {
                setDone(false);
                setFields({ name: "", gender: "MALE", birthYear: "", birthPlace: "", note: "" });
              }}
              className="mt-4 rounded border border-border px-4 py-1.5 text-sm hover:bg-muted"
            >
              再添加一位子女
            </button>
          ) : null}
        </div>
      </Card>
    );
  }

  const isUpdate = data.mode === "PERSON_UPDATE";

  return (
    <Card>
      <div className="mb-4 border-b border-hairline pb-3">
        <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
          {data.family.name} · 信息采集
        </p>
        <h1 className="mt-1 text-lg font-semibold">
          {isUpdate
            ? `完善「${data.person.name}」的信息`
            : `为「${data.person.name}」添加子女`}
        </h1>
        <p className="mt-0.5 text-xs text-fg-muted">
          第 {data.person.generation} 世
          {data.person.generationChar ? `（${data.person.generationChar}）` : ""}
        </p>
        {data.note ? (
          <p className="mt-2 rounded bg-muted px-2 py-1.5 text-xs text-fg-muted">{data.note}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        <Field label={isUpdate ? "姓名" : "子女姓名"} required>
          <input value={fields.name ?? ""} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </Field>

        {isUpdate ? (
          <Field label="别名 / 字号">
            <input value={fields.alias ?? ""} onChange={(e) => set("alias", e.target.value)} className={inputCls} />
          </Field>
        ) : (
          <Field label="性别">
            <select value={fields.gender ?? "MALE"} onChange={(e) => set("gender", e.target.value)} className={inputCls}>
              <option value="MALE">男</option>
              <option value="FEMALE">女</option>
              <option value="UNKNOWN">不详</option>
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="出生年">
            <input
              inputMode="numeric"
              value={fields.birthYear ?? ""}
              onChange={(e) => set("birthYear", e.target.value.replace(/\D/g, ""))}
              placeholder="如 1980"
              className={inputCls}
            />
          </Field>
          {isUpdate ? (
            <Field label="去世年">
              <input
                inputMode="numeric"
                value={fields.deathYear ?? ""}
                onChange={(e) => set("deathYear", e.target.value.replace(/\D/g, ""))}
                className={inputCls}
              />
            </Field>
          ) : (
            <Field label="出生地">
              <input value={fields.birthPlace ?? ""} onChange={(e) => set("birthPlace", e.target.value)} className={inputCls} />
            </Field>
          )}
        </div>

        {isUpdate ? (
          <>
            <Field label="出生地">
              <input value={fields.birthPlace ?? ""} onChange={(e) => set("birthPlace", e.target.value)} className={inputCls} />
            </Field>
            <Field label="状态">
              <select value={fields.status ?? "ALIVE"} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="联系手机号">
              <input
                inputMode="tel"
                value={fields.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="便于日后在小程序里自动找到你（仅族长可见）"
                className={inputCls}
              />
            </Field>
          </>
        ) : null}

        <Field label="备注">
          <textarea
            value={fields.note ?? ""}
            onChange={(e) => set("note", e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>

        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-fg-muted">填写人信息（便于族长核对）</p>
          <div className="space-y-2">
            <input
              value={contributor.name}
              onChange={(e) => setContributor((p) => ({ ...p, name: e.target.value }))}
              placeholder="您的姓名 *"
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={contributor.relation}
                onChange={(e) => setContributor((p) => ({ ...p, relation: e.target.value }))}
                placeholder="与TA的关系（如本人/长子）"
                className={inputCls}
              />
              <input
                value={contributor.phone}
                onChange={(e) => setContributor((p) => ({ ...p, phone: e.target.value }))}
                placeholder="联系电话（选填）"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}

        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-brand-fg hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "提交中…" : "提交"}
        </button>
        <p className="text-center text-[11px] text-fg-subtle">
          提交后需族长 / 管理员审核通过才会录入家谱。
        </p>
      </div>
    </Card>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5 shadow-sm">{children}</div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-fg-muted">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
