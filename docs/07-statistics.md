# 统计与报表

## 1. 设计原则

- **可解释**：每次响应携带 `filter_applied`, `sample_size`, `missing_data_rate`, `computed_at`。
- **一致**：列表筛选与统计筛选共用同一 Filter 解析模块（前后端双实现需对齐测试）。
- **可扩展**：新指标通过注册表增加，不破坏已有 `metric_key`。

## 2. 指标目录

### 2.1 概览（Overview）

| metric_key | 说明 | 数据依赖 |
|------------|------|----------|
| `person.total` | 人员总数（不含软删） | person |
| `person.living` / `person.deceased` | 在世/故 | 存殁 |
| `person.sex_ratio` | 男女比 | 性别 |
| `tree.max_generation_depth` | 相对根的最大代数 | 关系推导 |
| `data.completeness_score` | 加权完整度 0–100 | 多字段缺失率 |

### 2.2 结构（Structure）

| metric_key | 说明 |
|------------|------|
| `structure.count_by_generation` | 每代人数 |
| `structure.count_by_branch` | 以各房支根为桶的人数 |
| `structure.children_distribution` | 每位父母的子女数分布 |
| `structure.marriage_order_distribution` | 婚姻段数（有数据时） |

### 2.3 生命周期（Lifecycle）

| metric_key | 说明 |
|------------|------|
| `life.birth_year_histogram` | 出生年直方图（按配置 bin） |
| `life.age_at_death` | 寿命分布（需卒年与生年） |
| `life.age_at_marriage` | 结婚年龄（需结婚事件） |
| `life.parent_child_age_gap` | 亲子年龄差分布 |

### 2.4 地理（Geography）

| metric_key | 说明 |
|------------|------|
| `geo.birth_place_top` | 出生地 Top-N |
| `geo.residence_top` | 现居/常住 Top-N |
| `geo.migration_edges` | 迁徙 OD 聚合（依赖迁徙事件） |

### 2.5 字辈（Generation title）

| metric_key | 说明 |
|------------|------|
| `title.count_by_ordinal` | 各字辈人数 |
| `title.name_compliance_rate` | 姓名与字辈规则匹配比例（规则可配置） |

### 2.6 数据质量（Quality）

| metric_key | 说明 |
|------------|------|
| `quality.missing_birth` | 缺生年比例 |
| `quality.missing_death_among_deceased` | 故者缺卒年 |
| `quality.missing_parents` | 缺父/缺母计数 |
| `quality.unsourced_relationships` | 无来源关系占比 |

## 3. 预聚合与快照

- 租户人数 **< 5k** 可实时 SQL；更大时：
  - 关系/人员变更入队，Worker 合并后重算 `stats_snapshot`。
  - `filter_hash`：规范化 filter JSON（排序键）后 SHA256。

## 4. 自定义报表

- 用户保存 `report_definition`：维度、指标列表、图表类型。
- 导出：服务端渲染与数据源一致（禁止前端另算一遍导致不一致）。

## 5. 脱敏导出

- 导出配置：`redact: [phone, address, exact_birth_date_for_living]`。
- 脱敏规则与详情 API 字段剥离共用策略引擎。
