# TOP Agency 営業管理アプリ 設計仕様書

## アプリ概要
au光販売代理店向け営業管理アプリ。
メンバーが日報・行動量を入力し、個人・チーム数値を可視化する。

## 技術スタック
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- デプロイ: Vercel（git push → 自動デプロイ）
- データ保存: GAS (Google Apps Script) 経由で Google スプレッドシートに保存
- 認証: JWT (jsonwebtoken) 7日間有効

## URL・認証情報
- 本番: https://topagency-sales-app.vercel.app
- GitHub: https://github.com/topagencyjp-a11y/top-agency-app
- 共通パスワード: top2024
- 管理者パスワード: topMgr2024!（GAS内の MANAGER_PASSWORD）
- JWT_SECRET: 環境変数 or デフォルト 'top-sales-secret'
- GAS URL: lib/api.ts の GAS_URL 定数を参照（CLAUDE.md には書かない・ズレるため）

## メンバー構成 (lib/members.ts)
- クローザー（目標15件）: プラ・岩永・橋本・高木
- アポインター→クローザー（目標10件）: 長谷川・中西
- アポインター（目標5件）: 佐藤・小島
- チーム月間目標: TEAM_TARGET = 80件（静的定数）
- 実際のチーム目標: members.reduce((s,m) => s + m.target, 0) で動的に算出

---

## ページ構成（現在の実装）

### ナビゲーション
現状: layout.tsx はラッパーのみ（ボトムナビ未実装）
各ページはヘッダーの「← 戻る」で dashboard に戻る構造
ドロワーメニュー（dashboard/page.tsx 右上 ☰）から各ページへ遷移

### ページ一覧

| パス | 役割 | 状態 |
|---|---|---|
| app/dashboard/page.tsx | 入力・個人・分析・全体の4タブ | 実装済み（要改善） |
| app/dashboard/stats/page.tsx | 件数管理 | ✅ 完成（2025-04-27 再構築）|
| app/dashboard/conversion/page.tsx | 転換率分析・ボトルネック・改善TIPS | 実装済み |
| app/dashboard/reports/page.tsx | 日報一覧・展開閲覧・コピー | 実装済み |
| app/dashboard/shift/page.tsx | シフト入力・全体確認 | 実装済み |
| app/dashboard/daily/page.tsx | 日別稼働グリッド（全員カレンダー） | 実装済み |
| app/dashboard/settings/page.tsx | メンバー管理・パスワード変更 | 実装済み |
| app/login/page.tsx | ログイン（氏名選択＋パスワード） | 実装済み |

---

## 各ページ詳細

### ✏️ dashboard/page.tsx（メインページ・4タブ）
**メンバーが毎日使う最重要ページ**

タブ構成:
- **入力タブ**: 日付切替・稼働時間・行動量5項目・獲得エリア選択・日報6項目・感謝・コピー/保存
- **個人タブ**: KPI・達成率・着地予測・行動量合計・対面率・獲得率（責任者は他メンバー閲覧可）
- **分析タブ**: 転換率ファネル（訪問→対面→主権→商談→契約）・メンバー別転換率
- **全体タブ**: チームKPI・着地予測・ランキングバー・行動量グリッド・メンバー別テーブル

入力フォーム state:
```typescript
{ visits, netMeet, mainMeet, negotiation, acquired,
  startTime, endTime,
  acquiredCase, lostCase, goodPoints, issues, improvements, learnings,
  gratitude, planDays,  // planDays は今も存在（月初設定フロー未実装のため）
  area1〜area10 }
```

ドロワーメニュー（☰）からのリンク:
- シフト提出 → /dashboard/shift
- シフト提出確認 → /dashboard/shift?view=confirm
- 日別稼働 → /dashboard/daily
- 日報管理 → /dashboard/reports
- 設定 → /dashboard/settings

### 📊 stats/page.tsx（件数管理）
期間セレクター（今月/今週/月選択）＋4カードサマリー＋2つのランキングバー＋詳細テーブル
lib/calcStats.ts を使用。20秒自動ポーリング。

### 🔄 conversion/page.tsx（転換率分析）
転換率ファネル・ボトルネック検出・各ステップ別改善TIPS（TIPS定数で管理）
メンバー別転換率テーブル。

### 📝 reports/page.tsx（日報管理）
月別・メンバー別フィルタ。展開/折りたたみ。クリップボードコピー。

### 📅 shift/page.tsx（シフト管理）
- submit ビュー: 自分のカレンダー（タップで稼働/休日切替）
- confirm ビュー: 全メンバーの月間シフトテーブル（今日列ハイライト）
- 今月の稼働日数カウント表示

### 📆 daily/page.tsx（日別稼働グリッド）
全メンバー × 月全日のグリッド。シフト状態＋報告有無を一覧表示。
責任者がチーム全体の活動状況を把握するためのビュー。

### ⚙️ settings/page.tsx（設定）
- メンバー追加・編集（名前・役割・月間目標・責任者フラグ）・削除
- デフォルトメンバーへリセット
- パスワード変更（GAS経由で更新）
- 責任者のみアクセス可（isManager チェック）

---

## データ構造

### GASスプレッドシート シート構成

#### reports シート
```
name, date, visits, netMeet, mainMeet, negotiation, acquired,
startTime, endTime, acquiredCase, lostCase, goodPoints, issues,
improvements, learnings, gratitude, planDays,
area1〜area10,
updatedAt, updatedBy
```
- name+date でUPSERT
- saveReport 実行時に updatedAt/updatedBy を自動書き込み
- saveReport 実行時に updateMonthlySummary を自動呼び出し

#### shifts シート
`name, date, status, updatedAt, updatedBy`
- status: '稼働' | '休日' | ''

#### メンバー設定 シート
`id, name, role, target, isManager, password, planDays`

#### 月次サマリー シート（GAS自動生成）
`month, name, totalVisits, totalNetMeet, totalMainMeet, totalNegotiation, totalAcquired, workedDays, productivity, forecast, meetRate, getRate, updatedAt`

### lib/calcStats.ts（共通計算ロジック）
```typescript
getPeriodReports(reports, period)   // 今月/今週/YYYY-MM でフィルタ
calcMemberStats(periodReports, member, period) // 個人統計
calcTeamStats(memberStats, teamTarget)         // チーム統計
```
- period = 'month' | 'week' | 'YYYY-MM'
- 週間期間は月間目標を÷4換算したperiodTargetを使用
- 全ページでこの関数を使う（各ページで独自計算しない）

### lib/api.ts（GAS通信関数）
```typescript
saveReport(data)
getReports(params?)          // { name?, month?, week? } または文字列
getMonthlySummary(month)
getAvailableMonths(reports)  // ローカル計算（同期関数）
saveShift(name, date, status)
getShifts()
getMembersFromGAS()
saveMembersToGAS(members)
updatePasswordInGAS(id, current, next)
adminUpdateReport(data, adminName)
```

---

## 権限設計
- **責任者** (isManager=true): 全メンバーのデータ閲覧・編集・修正・設定ページアクセス
- **一般メンバー**: 自分のデータのみ（個人タブで他人閲覧不可）
- **管理者パスワード**: topMgr2024! でログインすると isManager=true 扱い

---

## 実装パターン（全ページ共通）

### データロード
```typescript
// 起動時: localStorageキャッシュ → 即時表示
// バックグラウンド: GAS fetch → 更新
// 20秒ポーリング + visibilitychange で自動更新
// formDirty.current が true の間は入力中フォームを上書きしない
```

### バックグラウンド同期
```typescript
const initialLoadDone = useRef(false);
const formDirty = useRef(false);  // 入力中フラグ（inputページ）
```

---

## 開発ルール
- `npm run build` でエラーがないことを確認してから push
- TypeScript strict モード（strict: true）
- lib/calcStats.ts を必ず使う（各ページで独自の計算ロジックを書かない）
- any 型は最小限に（GAS レスポンス等やむを得ない箇所のみ）
- コメントは WHY が非自明な場合のみ（WHAT は書かない）
