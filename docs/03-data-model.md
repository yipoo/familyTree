# 数据模型

> 版本：v0.1（草案）
> 配套：`01-requirements.md`、`02-architecture.md`
> ORM：Prisma；DB：PostgreSQL

## 1. ER 总览

```
User ──< FamilyMember >── Family ──< Branch
                              │       │
                              │       └──< Migration (支系级)
                              │
                              ├──< GenerationName  (字辈表，固定)
                              ├──< Person ──< Marriage >── Person
                              │       │
                              │       ├──< ParentChild (作为 child)
                              │       ├──< ParentChild (作为 parent)
                              │       ├──< Migration (个人级)
                              │       └──< PersonLocation
                              │
                              ├──< ShareLink
                              └──< AuditLog
```

## 2. 表定义（Prisma 风格伪代码）

### 2.1 用户与家族成员

```prisma
model User {
  id            String   @id @default(cuid())
  email         String?  @unique
  phone         String?  @unique
  passwordHash  String?
  name          String
  avatarUrl     String?
  createdAt     DateTime @default(now())
  members       FamilyMember[]
}

model Family {
  id            String   @id @default(cuid())
  surname       String                    // 姓氏，如"丁"
  name          String                    // 显示名，如"丁氏家族"
  founderName   String?                   // 始祖姓名
  description   String?
  ownerId       String                    // 创建者 user.id
  createdAt     DateTime @default(now())

  members          FamilyMember[]
  generationNames  GenerationName[]
  persons          Person[]
  branches         Branch[]
  migrations       Migration[]
  shareLinks       ShareLink[]
}

enum FamilyRole { OWNER ADMIN MEMBER GUEST }

model FamilyMember {
  id        String     @id @default(cuid())
  userId    String
  familyId  String
  role      FamilyRole
  // 该成员对应族谱里的哪个人物（用于"补录自己分支"权限判定）
  personId  String?
  joinedAt  DateTime   @default(now())

  @@unique([userId, familyId])
  @@index([familyId])
}
```

### 2.2 字辈表（固定）

```prisma
model GenerationName {
  id          String  @id @default(cuid())
  familyId    String
  generation  Int                     // 第几世，从 1 开始
  character   String                  // 该世字辈用字，如"良"

  @@unique([familyId, generation])
  @@index([familyId])
}
```

> 一次性录入，普通流程不动态扩展；管理员显式编辑作为纠错入口。

### 2.3 人物

```prisma
enum Gender { MALE FEMALE UNKNOWN }
enum LifeStatus { ALIVE DECEASED LOST UNKNOWN }

model Person {
  id            String     @id @default(cuid())
  familyId      String                       // 多租户键
  branchId      String?                      // 所属支系（可空）
  name          String                       // 姓名（含全名或"X氏"）
  surnameOnly   Boolean    @default(false)   // 仅记姓（嫁入女性常见）
  gender        Gender
  generation    Int                          // 第几世
  generationChar String?                     // 该人字辈用字（冗余，便于显示）
  birthYear     Int?
  deathYear     Int?
  birthDate     String?                      // 农历或不完整日期，存原文
  deathDate     String?
  status        LifeStatus @default(ALIVE)
  avatarUrl     String?
  note          String?

  // 是否由"嫁入/入赘"产生（关系另存于 Marriage，这里只是显示用标记）
  isMarriedIn   Boolean    @default(false)

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  // 关系反向引用
  marriagesAsHusband Marriage[]    @relation("husband")
  marriagesAsWife    Marriage[]    @relation("wife")
  childRelations     ParentChild[] @relation("childSide")
  parentRelations    ParentChild[] @relation("parentSide")
  locations          PersonLocation[]
  migrations         Migration[]   @relation("personMigration")

  @@index([familyId, generation])
  @@index([familyId, branchId])
  @@index([familyId, name])
}
```

### 2.4 婚姻（含原配/继配/入赘）

```prisma
enum MarriageType { PRIMARY SECONDARY CONCUBINE UXORILOCAL }
//   PRIMARY=原配  SECONDARY=继配  CONCUBINE=妾（历史数据）  UXORILOCAL=入赘

model Marriage {
  id           String        @id @default(cuid())
  familyId     String
  husbandId    String                     // 男方 person.id
  wifeId       String                     // 女方 person.id
  type         MarriageType  @default(PRIMARY)
  order        Int           @default(1)  // 该男方/女方的婚姻次序
  marriedYear  Int?
  endedYear    Int?
  endedReason  String?                    // 离/丧/...
  note         String?

  husband      Person        @relation("husband", fields: [husbandId], references: [id])
  wife         Person        @relation("wife",    fields: [wifeId],    references: [id])

  @@index([familyId, husbandId])
  @@index([familyId, wifeId])
}
```

> 招赘语义：`type = UXORILOCAL` 时，该婚姻所产子女的 `Person.familyId / branchId / generation` 按**女方**家族登记；男方 `Person.isMarriedIn = true`。

### 2.5 亲子（支持过继）

```prisma
enum ParentRelation { BIOLOGICAL ADOPTED FOSTER STEP }

model ParentChild {
  id           String          @id @default(cuid())
  familyId     String
  parentId     String                       // 父或母
  childId      String
  relation     ParentRelation  @default(BIOLOGICAL)
  birthOrder   Int?                          // 子女排行（同一对父母下）
  isPrimary    Boolean         @default(true) // 是否登记为主要父母（过继时区分生/养）

  parent       Person          @relation("parentSide", fields: [parentId], references: [id])
  child        Person          @relation("childSide",  fields: [childId],  references: [id])

  @@unique([parentId, childId, relation])
  @@index([familyId, parentId])
  @@index([familyId, childId])
}
```

> 一个孩子可以有多条 `ParentChild`（生父+生母+养父+养母），用 `relation` 与 `isPrimary` 区分。

### 2.6 支系

```prisma
model Branch {
  id            String   @id @default(cuid())
  familyId      String
  name          String                    // 如"十七世训贤支"
  rootPersonId  String                    // 支系根人物
  locationId    String?                   // 现住地
  description   String?

  migrations    Migration[]

  @@index([familyId])
}
```

### 2.7 地点与迁徙

```prisma
model Location {
  id          String  @id @default(cuid())
  province    String?
  city        String?
  county      String?
  town        String?
  village     String?
  detail      String?       // 门牌、自由文本
  fullText    String        // 拼接全名，便于搜索
}

model PersonLocation {
  id          String   @id @default(cuid())
  personId    String
  locationId  String
  fromYear    Int?
  toYear      Int?
  isCurrent   Boolean  @default(false)
}

enum MigrationScope { BRANCH PERSON }

model Migration {
  id            String          @id @default(cuid())
  familyId      String
  scope         MigrationScope            // 支系级 or 个人级
  branchId      String?                   // scope=BRANCH 时
  personId      String?                   // scope=PERSON 时
  year          Int?
  fromLocationId String?
  toLocationId   String?
  reason        String?                   // "分居" "塌陷" "战乱" 等
  note          String?

  person        Person?  @relation("personMigration", fields: [personId], references: [id])

  @@index([familyId, branchId])
  @@index([familyId, personId])
}
```

### 2.8 协作 / 分享 / 审计

```prisma
model ShareLink {
  id          String   @id @default(cuid())
  familyId    String
  token       String   @unique
  scope       Json                   // 可见范围：整族 / 某支系 / 某人
  expiresAt   DateTime?
  passwordHash String?
  createdBy   String
  createdAt   DateTime @default(now())
}

enum ChangeKind { CREATE UPDATE DELETE APPROVE REJECT }

model AuditLog {
  id          String     @id @default(cuid())
  familyId    String
  actorId     String                 // user.id
  kind        ChangeKind
  entity      String                 // "Person" | "Marriage" | ...
  entityId    String
  before      Json?
  after       Json?
  createdAt   DateTime   @default(now())

  @@index([familyId, createdAt])
}

enum SubmissionStatus { PENDING APPROVED REJECTED }

model PendingSubmission {
  id          String           @id @default(cuid())
  familyId    String
  submitterId String                       // 普通成员
  payload     Json                         // 待写入的人物/关系草稿
  status      SubmissionStatus @default(PENDING)
  reviewerId  String?
  reviewNote  String?
  createdAt   DateTime         @default(now())
  reviewedAt  DateTime?

  @@index([familyId, status])
}
```

## 3. 关键约束与一致性

1. **多租户**：所有业务表必带 `familyId`；外键引用必须同 `familyId`（应用层校验）
2. **世代单调**：`Person.generation = parent.generation + 1`（除入赘的特殊归属逻辑）
3. **字辈一致**：`Person.generationChar` 应与 `GenerationName{ familyId, generation }.character` 一致；不一致需提示
4. **婚姻次序**：同一 `husbandId` 下 `(order)` 唯一且连续；`PRIMARY` 仅一条
5. **删除策略**：人物默认软删（增加 `deletedAt`），保留审计；硬删仅 Owner 可执行

## 4. 索引与性能

- 树渲染主查询：`Person where familyId AND (branchId IN ...) ORDER BY generation, birthOrder`
- 近亲查询：以 `personId` 为根做内存 BFS，预先一次性加载族内所有 `Person + ParentChild + Marriage`
- 单族数据量预估：≤ 5000 人 / ≤ 8000 关系 / ≤ 2000 迁徙记录，全量加载内存即可

## 5. 迁移与种子数据

- 初始迁移由 Prisma 生成
- 提供丁氏家族 demo 种子（基于 `docs/2.png`、`docs/详细图.pdf`）用于本地开发与演示
- 字辈示例：`良 / 允 / 贤 / 方 / 正 / 维 / 先 / 克`

## 6. 待定 / 后续

- GEDCOM 互通字段映射（远期）
- 多媒体（家族照片、墓地照片、扫描件）模型扩展
- 全文搜索：一期用 PostgreSQL `pg_trgm`；远期可接 ElasticSearch
