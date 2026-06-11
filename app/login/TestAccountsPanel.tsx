"use client";

/**
 * 本地测试账号快捷填充（仅开发环境渲染，生产永不出现）。
 *
 * 点击某账号 → 把手机号 + 密码填入登录表单的 identifier / password 框。
 * 表单是非受控原生 <form>，直接设 input.value 即可（再派发 input 事件以兼容潜在监听）。
 */

export interface TestAccount {
  phone: string;
  name: string;
  role: string;
}

export function TestAccountsPanel({
  accounts,
  password,
}: {
  accounts: TestAccount[];
  password: string;
}) {
  function fill(a: TestAccount) {
    const id = document.querySelector<HTMLInputElement>('input[name="identifier"]');
    const pw = document.querySelector<HTMLInputElement>('input[name="password"]');
    if (id) {
      id.value = a.phone;
      id.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (pw) {
      pw.value = password;
      pw.dispatchEvent(new Event("input", { bubbles: true }));
    }
    pw?.focus();
  }

  return (
    <div className="mt-3 w-full rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
      <p className="mb-2 text-xs font-medium text-amber-800 dark:text-amber-300">
        🧪 测试账号（仅本地 · 点击自动填入）
      </p>
      <div className="flex flex-wrap gap-1.5">
        {accounts.map((a) => (
          <button
            key={a.phone}
            type="button"
            onClick={() => fill(a)}
            title={`${a.phone} / ${password}`}
            className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-zinc-700 transition hover:bg-amber-100 dark:border-amber-800/60 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-amber-950/40"
          >
            <span className="font-medium">{a.name}</span>
            <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400">{a.role}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-amber-700/80 dark:text-amber-400/80">
        统一密码：{password}（点击后按"登录"即可）
      </p>
    </div>
  );
}
