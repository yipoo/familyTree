# 微信小程序「只读端」设计方案（2026-06）

> 目标：族人用微信打开小程序 → **手机号/微信自动识别身份 → 定位 TA 在族谱中的位置** → 只读浏览族谱（族谱圆 / 吊线图 / 人物 / 相册 / 搜索）。编辑仍走 web 与二维码采集。

---

## 0. 一句话架构

小程序是**独立前端**，通过 HTTPS 调用现有 Next.js 后端新增的 `/api/miniapp/*`（只读 + 鉴权）。**手机号是唯一身份键**：`User.phone`（登录身份）⇄ `Person`（族谱节点）通过手机号哈希匹配自动绑定，定位"我的位置"。

```
微信小程序 (Taro/原生)
   │  wx.login() / getPhoneNumber()
   ▼
/api/miniapp/login、/bind-phone   ── jscode2session / phonenumber.getPhoneNumber → openid + 手机号
   │  自动绑定：phone → User → Person 节点
   ▼
/api/miniapp/families/:id/(circle|lineage|tree|person|search)  ── 复用 wufu/radial/lineage/kinship 等现有算法
```

---

## 1. 范围

**做（只读）**：我的家族列表、"我的位置"（以我为中心的族谱圆 / 直系世系 / 近亲五代）、吊线图、人物详情（含相册、已生成的 AI 传记）、搜索、五服图。
**不做**：增删改人物（走 web）、后台管理。可保留一个"二维码采集自填"入口（属于提交待审，不算编辑库）。

---

## 2. 登录与自动绑定（核心）

### 2.1 微信登录链路
1. 小程序 `wx.login()` → 临时 `code`。
2. 后端 `POST /api/miniapp/login {code}` → 调微信 `jscode2session(AppID, AppSecret, code)` → `openid` (+ `unionid`)。
3. 查 openid 是否已绑定 `User`：
   - **命中** → 直接签发小程序 token，返回"我的家族 + 我的位置"。
   - **未命中** → 返回 `needPhone: true`，引导授权手机号。

### 2.2 手机号授权 → 唯一身份
4. 小程序用 `<button open-type="getPhoneNumber">` → 拿到 `phoneCode`。
5. 后端 `POST /api/miniapp/bind-phone {phoneCode}` → 调微信 `phonenumber.getPhoneNumber` → **真实手机号**。
6. 以手机号为唯一键：`upsert User by phone`（`User.phone` 已是 unique），把 `openid` 绑定到该 User（便于下次免授权）。
7. **自动定位族谱位置**（见 2.3）。

### 2.3 "定位我的位置"——手机号 ⇄ Person 节点

这是关键。`Person` 当前**没有手机号**，需要一条 phone→Person 的通路。三种方案：

| 方案 | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A 自动匹配** | `Person` 加 `contactPhoneHash`（仅在世族人），登录手机号哈希比对 → 命中即自动绑定 `FamilyMember.personId` | 真·自动，契合"以手机号为唯一识别" | 需逐步录入在世族人手机号（靠二维码采集/管理员） |
| **B 手动认领** | 首次让用户在树里搜到自己，点"这是我" → 设 `FamilyMember.personId`（可选族长确认） | 无需 Person 存手机号、最准确 | 多一步、非自动 |
| **C 混合（推荐）** | 先走 A 自动匹配；无匹配/多匹配再走 B 认领 | 能自动就自动，兜底稳 | 两套都要做 |

**`contactPhoneHash` 来源**：① 二维码采集族人自填手机号；② 管理员录入；③ 用户认领时回填到自己节点。
**隐私**：手机号是 PII。`Person` 只存 `contactPhoneHash = sha256(normalizePhone(phone))`（normalize：去 +86/空格/分隔符），登录时把 `User.phone` 同法哈希后比对——库里**不存明文**，避免泄露族人手机号。

### 2.4 多家族
一个手机号可能在多个家族都有节点 → 登录后返回 `families: [{familyId, name, myPersonId?}]`，首页列出"我所属的家族"，进入后默认以 `myPersonId` 为中心。

### 2.5 游客（可选）
未匹配到任何节点的微信用户：可允许只读浏览 `isPublic` 家族（发现页那批），但看不到非公开家族。是否开放游客 = 待定决策。

---

## 3. 数据模型变更

```prisma
// User：绑定微信（支持一人多端；也可拆独立表）
model User {
  // ...现有字段
  wechatOpenId  String?  @unique   // 小程序 openid
  wechatUnionId String?            // 同主体跨应用（可选）
}

// Person：用于手机号自动匹配（仅在世族人，存哈希不存明文）
model Person {
  // ...现有字段
  contactPhoneHash String?  @index  // sha256(normalizePhone)，自动定位用
}

// 可选：认领审核（方案 B/C）
model PersonClaim {
  id        String  @id @default(cuid())
  familyId  String
  userId    String
  personId  String
  status    String  // PENDING / APPROVED / REJECTED
  createdAt DateTime @default(now())
  @@unique([userId, personId])
}
```

小程序 token：复用 JWT（载荷含 `userId` + `openid`），放 `Authorization: Bearer`，**不走 web 的 cookie session**（小程序无 cookie 习惯）。

---

## 4. 只读 API 面（`/api/miniapp/*`）

| 接口 | 作用 |
|---|---|
| `POST /api/miniapp/login {code}` | wx.login → openid → 老用户直接登录 / 新用户 `needPhone` |
| `POST /api/miniapp/bind-phone {phoneCode}` | 授权手机号 → upsert User、绑 openid、自动定位 → 返回 families + myPositions |
| `POST /api/miniapp/claim {familyId, personId}` | （方案 B/C）认领"这是我" |
| `GET /api/miniapp/me` | 我的家族 + 各家族中的我（personId） |
| `GET /api/miniapp/f/:id/circle?root=` | 族谱圆（复用 `radial-chart.ts`） |
| `GET /api/miniapp/f/:id/lineage?root=` | 吊线图（复用 `lineage-chart.ts`） |
| `GET /api/miniapp/f/:id/wufu?root=` | 五服图（复用 `wufu.ts`） |
| `GET /api/miniapp/f/:id/person/:pid` | 人物详情 + 相册（复用 Media） |
| `GET /api/miniapp/f/:id/search?q=` | 搜索 |

鉴权中间件：校验 Bearer token → 注入 userId；家族数据需校验该 user 是该家族成员（或家族 isPublic）。**复用现有算法服务**，只是换一层鉴权 + 输出裁剪（只读、不含敏感字段如他人手机号）。

---

## 5. 小程序页面

1. **登录/授权页** — wx.login 静默 + "授权手机号"按钮（仅首次）。
2. **我的家族** — 卡片列表，每个显示"我的位置：第N世 · 姓名"。
3. **我的位置（首页）** — 默认以我为中心：① 近亲五代（kin5）② 我的直系世系（始祖→我，吊线图高亮我）③ 一键切族谱圆。
4. **族谱圆 / 吊线图 / 树** — 只读浏览，点节点看详情。
5. **人物详情** — 基本信息 + 关系 + 相册 + 传记（只读）。
6. **搜索** — 按姓名找人，跳详情。
7. **五服图** — 以选定人为中心。

---

## 6. 技术选型（待决策）

| 选项 | 说明 |
|---|---|
| **Taro (React)** ⭐推荐 | 与现有 React/TS 技能栈一致；`wufu/radial/lineage` 算法是纯 TS，可**直接复用**到小程序端计算布局 |
| 原生微信小程序 | 体积小、官方支持最全；但要用 WXML/WXSS 重写，算法需移植 |
| uni-app (Vue) | 跨端强；但团队是 React 栈，收益不如 Taro |

**渲染难点**：族谱圆/吊线图在小程序里没有 SVG DOM，需用 **canvas**（`<canvas type="2d">`）或 Skyline。布局坐标由现有纯算法算好，canvas 只负责画——这正是把算法做成纯函数的红利。

---

## 7. 安全 / 合规

- **手机号 PII**：只存哈希、HTTPS 传输、最小返回（不向小程序吐他人手机号）。
- **非公开家族**：仅已绑定/成员可见；游客只能看 `isPublic`。
- **算法备案**：小程序若**内嵌** AI 生成（传记/对话）需算法备案；只读展示已生成文本一般风险低，但生成入口放 web 更稳。
- **逝者信息**：族谱含敏感家族信息，默认登录后可见，注意授权边界。

---

## 8. 需要你提供 / 决策

1. **微信小程序 AppID + AppSecret**（注册主体；后端 jscode2session/getPhoneNumber 必需）。
2. **绑定模型**：A 自动 / B 认领 / C 混合（推荐 C）。
3. **技术选型**：Taro（推荐）/ 原生 / uni-app。
4. **游客范围**：是否允许未匹配用户只读浏览公开家族。

---

## 9. 落地顺序（建议）

1. **后端先行（不依赖 AppID 也能写）**：schema 变更（openid / contactPhoneHash / claim）+ `/api/miniapp/*` + 手机号哈希匹配 + 认领。微信调用处用 `WX_APPID/WX_SECRET` env，先 mock，拿到密钥即通。
2. **二维码采集补手机号字段** → 喂养 `contactPhoneHash`（让自动匹配逐步生效）。
3. **小程序前端**（选型确定 + AppID 到位后）：登录/绑定 → 我的位置 → 各图谱 canvas 渲染。
