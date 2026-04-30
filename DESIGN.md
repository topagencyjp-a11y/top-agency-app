# TOP Agency 営業管理アプリ v2 設計図

最終更新: 2026-04-29

---

## 0. 変更の全体方針

| 領域 | 変更内容 |
|---|---|
| GASシート | 4シート追加・2シート変更（既存データ保持） |
| GAS API | 6アクション追加 |
| lib/ | members.ts型変更・api.ts関数追加 |
| app/dashboard/ | settings強化・stats/activity/personalにチームタブ追加・入力ページに獲得案件追加 |

**既存データは壊さない。** すべてのシート変更はrepair関数でマイグレーション対応する。

---

## 1. データ基盤（最重要・P0）

### 1-1. シート一覧（確定）

| シート名 | 変更 | キー |
|---|---|---|
| `reports` | カラム追加 | name + date |
| `shifts` | 変更なし | name + date |
| `メンバー設定` | カラム変更（後述） | id |
| `月次サマリー` | 変更なし | month + name |
| `teams` | **新規** | teamId |
| `月次計画` | **新規** | memberId + month |
| `獲得案件` | **新規** | caseId |

---

### 1-2. `メンバー設定` シート（変更）

**現在のヘッダー:**
```
id | name | role | target | isManager | password | planDays
```

**変更後:**
```
id | name | role | teamId | isManager | password
```

| カラム | 変更 | 理由 |
|---|---|---|
| `role` | 値を拡張: `closer` / `appointer` / `leader` | leader追加 |
| `teamId` | **追加** | チーム所属 |
| `isManager` | 残す（`role=leader`と連動） | 後方互換・認証で使用 |
| `target` | **削除** → `月次計画`シートへ移行 | 月ごとに変わる |
| `planDays` | **削除** → `月次計画`シートへ移行 | 月ごとに変わる |

**マイグレーション処理:**
- `target`・`planDays` を削除する前に、既存値を `月次計画` シートに移行する
- `role = 'closer'` or `'appointer'` の既存メンバーはそのまま
- `isManager = true` のメンバーは `role = 'leader'` に自動変換

---

### 1-3. `teams` シート（新規）

```
teamId | teamName | createdAt
```

| カラム | 型 | 説明 |
|---|---|---|
| `teamId` | string | 自動生成（例: `team_1746000000`） |
| `teamName` | string | 自由入力（例: "Aチーム"） |
| `createdAt` | datetime | 作成日時 |

- チームは複数作成可能
- 削除時はメンバーの `teamId` を空にする（参照整合性はアプリ側で保証）

---

### 1-4. `月次計画` シート（新規）

```
memberId | month | planDays | monthlyTarget | submittedBy | submittedAt
```

| カラム | 型 | 説明 |
|---|---|---|
| `memberId` | string | メンバーID |
| `month` | string | YYYY-MM |
| `planDays` | number | 計画稼働日数 |
| `monthlyTarget` | number | 月間目標件数 |
| `submittedBy` | string | 入力したリーダーのID |
| `submittedAt` | datetime | 提出日時 |

- キー: `memberId + month` でUPSERT
- 未入力の場合、フロント側で前月値をフォールバック表示

---

### 1-5. `獲得案件` シート（新規）

```
caseId | memberId | memberName | date | area | fromService | note | createdAt | updatedBy
```

| カラム | 型 | 説明 |
|---|---|---|
| `caseId` | string | `case_${timestamp}_${random}` |
| `memberId` | string | 担当者ID |
| `memberName` | string | 担当者名（表示用） |
| `date` | date | 獲得日（日報の日付） |
| `area` | string | 獲得エリア（自由入力） |
| `fromService` | string | 乗り換え元サービス（選択式） |
| `note` | string | 自由メモ |
| `createdAt` | datetime | 作成日時 |
| `updatedBy` | string | 最終更新者 |

**fromService 選択肢（マスタ）:**
```
J:COM / SB光 / SBair / さすがネット / 未利用 / BAYCOM / ドコモホーム / ドコモ光 / BIG光 / so-net光 / UQWiMAX / その他
```

- 日報の `acquired` 件数分だけ入力する（1獲得1行）
- 既存の `area1〜area10` フィールドはreportsシートから削除せず残す（後方互換）
- 新規入力は `獲得案件` シートに保存

---

### 1-6. `reports` シート（変更）

**追加カラム（末尾に追加）:**
```
correctedBy | correctedAt
```

- `updatedBy`/`updatedAt`: 通常の上書き保存時に更新
- `correctedBy`/`correctedAt`: リーダーが他メンバーを修正した時に記録

既存の `area1〜area10` / `acquiredCase` / `lostCase` はそのまま保持。

---

## 2. GAS API 変更（P0）

### 2-1. 変更が必要な既存アクション

| アクション | 変更内容 |
|---|---|
| `getMembers` | `teamId`返却・`target`/`planDays`削除 |
| `saveMembers` | `teamId`保存・`target`/`planDays`削除 |
| `getAccount` | `role=leader` → `isManager=true` で返す |
| `adminUpdateReport` | `isManager` or `role=leader` で権限確認 |

### 2-2. 新規追加アクション（doGet）

| action | パラメータ | レスポンス |
|---|---|---|
| `getTeams` | なし | `{ teams: [...] }` |
| `getMonthlyPlans` | `month`（YYYY-MM）, `memberId`（任意） | `{ plans: [...] }` |
| `getCases` | `memberId`（任意）, `month`（任意） | `{ cases: [...] }` |

### 2-3. 新規追加アクション（doPost）

| action | ペイロード | 説明 |
|---|---|---|
| `saveTeam` | `{ teamId?, teamName }` | チーム追加・更新 |
| `deleteTeam` | `{ teamId }` | チーム削除 |
| `saveMonthlyPlan` | `{ memberId, month, planDays, monthlyTarget, submittedBy }` | 月次計画UPSERT |
| `saveCase` | `{ caseId?, memberId, memberName, date, area, fromService, note, updatedBy }` | 案件UPSERT |
| `deleteCase` | `{ caseId, requestedBy }` | 案件削除（本人 or リーダーのみ） |

---

## 3. フロントエンド変更

### 3-1. 型定義変更（lib/members.ts）

**現在:**
```typescript
type Member = {
  id: string;
  name: string;
  role: 'closer' | 'appointer';
  target: number;
  isManager?: boolean;
};
```

**変更後:**
```typescript
type Member = {
  id: string;
  name: string;
  role: 'closer' | 'appointer' | 'leader';
  teamId?: string;
  isManager?: boolean; // role=leaderと連動、後方互換用
};

type Team = {
  teamId: string;
  teamName: string;
};

type MonthlyPlan = {
  memberId: string;
  month: string;
  planDays: number;
  monthlyTarget: number;
  submittedBy: string;
};

type AcquisitionCase = {
  caseId: string;
  memberId: string;
  memberName: string;
  date: string;
  area: string;
  fromService: string;
  note: string;
};

const FROM_SERVICE_OPTIONS = [
  'SB光', 'docomo光', 'NTT光（フレッツ）', 'eo光', 'NURO光', '未利用', 'その他'
] as const;
```

### 3-2. API関数追加（lib/api.ts）

```typescript
// チーム
getTeams(): Promise<Team[]>
saveTeam(data: { teamId?: string; teamName: string }): Promise<{ success: boolean }>
deleteTeam(teamId: string): Promise<{ success: boolean }>

// 月次計画
getMonthlyPlans(month: string, memberId?: string): Promise<MonthlyPlan[]>
saveMonthlyPlan(data: MonthlyPlan): Promise<{ success: boolean }>

// 獲得案件
getCases(params?: { memberId?: string; month?: string }): Promise<AcquisitionCase[]>
saveCase(data: Omit<AcquisitionCase, 'caseId'> & { caseId?: string }): Promise<{ success: boolean }>
deleteCase(caseId: string, requestedBy: string): Promise<{ success: boolean }>
```

### 3-3. ページ別変更

#### ✏️ dashboard/page.tsx（入力ページ）
- **獲得件数と連動した獲得案件入力モーダル追加**
  - `acquired` の数値を確定した後「案件詳細を入力」ボタン
  - エリア（テキスト）・乗り換え元サービス（セレクト）・メモ（テキスト）× acquired件数分
  - 保存時に `saveCase` を件数分呼ぶ
- **計画稼働日数の入力廃止**
  - 月初モーダルを削除。`月次計画` シートから取得して表示のみ

#### 📊 stats/page.tsx（件数管理）
- **チームタブ追加**
  - 「全体」タブ + 各チーム名タブ（チームごとに絞り込み表示）
- **数値上書きUI（リーダーのみ）**
  - テーブル行をタップ → 編集モーダル → `adminUpdateReport` で保存

#### 🔄 activity/page.tsx（行動量管理）
- **チームタブ追加**（stats同様）

#### 👤 personal/page.tsx（個人分析）
- **月次計画の表示を `月次計画` シートから取得に変更**
- **獲得エリア分析に `fromService` 集計を追加**

#### ⚙️ settings/page.tsx（設定）
- **チーム管理セクション追加**
  - チーム一覧・追加・削除・名前変更
  - メンバーのチーム割り当てUI（ドラッグ or セレクト）
  - メンバーのrole変更（closer / appointer / leader）
- **月次計画入力セクション追加（リーダーのみ）**
  - 月選択 → 自チームメンバー全員の `planDays` / `monthlyTarget` を一括入力
- **既存: メンバー追加・削除・パスワード変更は維持**

---

## 4. 実装優先順位

### P0（データ基盤・最初に着手）

| # | 作業 | ファイル |
|---|---|---|
| 1 | `teams` シート + GAS CRUD | gas_script.js |
| 2 | `月次計画` シート + GAS CRUD | gas_script.js |
| 3 | `獲得案件` シート + GAS CRUD | gas_script.js |
| 4 | `メンバー設定` マイグレーション（teamId追加・target/planDays削除） | gas_script.js |
| 5 | `reports` マイグレーション（correctedBy/correctedAt追加） | gas_script.js |
| 6 | 型定義更新（lib/members.ts） | members.ts |
| 7 | API関数追加（lib/api.ts） | api.ts |

### P1（設定画面・権限の基盤）

| # | 作業 | ファイル |
|---|---|---|
| 8 | settings: チーム管理UI | settings/page.tsx |
| 9 | settings: 月次計画入力UI（リーダーのみ） | settings/page.tsx |
| 10 | 認証: roleベースの権限切り替え | lib/auth.ts |

### P2（数値上書き・チーム表示）

| # | 作業 | ファイル |
|---|---|---|
| 11 | stats: 数値上書きUI（リーダーのみ） | stats/page.tsx |
| 12 | stats / activity: チームタブ追加 | stats/page.tsx, activity/page.tsx |

### P3（獲得案件・個人分析強化）

| # | 作業 | ファイル |
|---|---|---|
| 13 | dashboard: 獲得案件入力モーダル | page.tsx |
| 14 | personal: fromService集計表示 | personal/page.tsx |

---

## 5. マイグレーション戦略

既存データを壊さないための手順：

1. **GASをデプロイする前に** スプレッドシートのバックアップコピーを取る
2. GAS更新後、`repairMembersSheet()` を手動実行 → teamId列追加・既存値保持
3. `migrateTargetAndPlanDays()` を手動実行 → 既存の target/planDays を月次計画シートに移行
4. アプリ側は `teamId` が空でも動作するようにフォールバックを実装する
5. 設定画面からチーム割り当てを行う（運用側で実施）

---

## 6. 権限マトリックス（確定版）

| 操作 | 一般メンバー | チームリーダー |
|---|---|---|
| 自分の日報 入力・上書き | ✅ | ✅ |
| 自分の獲得案件 入力・編集・削除 | ✅ | ✅ |
| 他メンバーの日報 閲覧 | ❌ | 自チームのみ ✅ |
| 他メンバーの日報 上書き修正 | ❌ | 自チームのみ ✅ |
| 月次計画 入力（自チーム全員分） | ❌ | ✅ |
| チーム管理（作成・割り当て） | ❌ | ✅ |
| メンバー管理（追加・削除） | ❌ | ✅ |
| 全体集計 閲覧 | ❌ | ✅ |
