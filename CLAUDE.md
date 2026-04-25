# TOP Agency 営業管理アプリ

## プロジェクト概要
au光販売代理店向けの営業管理アプリ。メンバーが日報・行動量を入力し、個人・チーム数値を可視化する。

## 技術スタック
- Next.js (App Router) + TypeScript + Tailwind CSS
- Vercel デプロイ（固定費ゼロ）
- データ: GAS経由でGoogleスプレッドシートに保存
- 認証: JWT (jsonwebtoken)

## URL情報
- 本番: https://topagency-sales-app.vercel.app
- GitHub: https://github.com/topagencyjp-a11y/top-agency-app
- パスワード: top2024（全員共通）
- GAS URL: https://script.google.com/macros/s/AKfycbyhbSNrD5-JdXWW4SCnXeUK7bcm3-o1mm8nq4e8wSlAhG9MhHHOELiUoD_QgrztPAOWug/exec

## メンバー構成 (lib/members.ts)
- クローザー（目標15件）: プラ・岩永・橋本・高木
- アポインター→クローザー（目標10件）: 長谷川・中西
- アポインター（目標5件）: 佐藤・小島
- チーム月間目標: 80件

## ファイル構成
app/
  dashboard/
    page.tsx          # 入力・自分・全体・契約宅タブ
    layout.tsx        # ボトムナビ（5タブ）
    stats/page.tsx    # 数値管理（チームKPI・メンバー別）
    conversion/page.tsx # 転換率分析・ボトルネック検出
    reports/page.tsx  # 日報管理・閲覧・コピー
    shift/page.tsx    # シフト管理・今日の稼働状況
  login/page.tsx      # ログイン（氏名選択+パスワード）
  api/auth/login/route.ts
lib/
  members.ts          # メンバー定義・目標
  api.ts              # GAS通信（saveReport/getReports/saveShift/getShifts）
  auth.ts             # JWT生成・検証

## ページ・機能一覧
1. ✏️ 入力: 日付変更・稼働時間・行動量（±ボタン+数値入力）・日報・コピー機能
2. 📊 自分: 個人KPI・達成率・着地予測・行動量合計・対面率・獲得率
3. 🏆 全体: チーム獲得・着地予測・ランキングバー・行動量・メンバー別テーブル
4. 🏠 契約宅: 工事日電話リスト・全獲得案件
5. 📊 数値管理: チームKPI・行動量・個人詳細・各種率
6. 🔄 転換率: ファネル・ボトルネック自動検出・改善策・メンバー別転換率
7. 📝 日報管理: 一覧・展開閲覧・コピー
8. 📅 シフト: カレンダー入力・今日の稼働状況・全体確認

## データ構造（GASスプレッドシート）
### reportsシート
name, date, visits, netMeet, mainMeet, negotiation, acquired,
startTime, endTime, acquiredCase, lostCase, goodPoints, issues,
improvements, learnings, gratitude, planDays

### shiftsシート
name, date, status（稼働/休日）

## 次にやりたいこと（TODO）
- [ ] 権限分離（責任者は全員分・メンバーは自分のみ閲覧）
- [ ] シフトデータをGASに保存（現在はlocalStorageのみ）
- [ ] 転換率のベンチマーク値を調整可能にする
- [ ] 月次レポート自動生成

## 開発ルール
- git push後にVercelが自動デプロイ
- TypeScriptエラーはビルド失敗になるので必ずnpm run buildで確認
- UNIT_PRICE・OPEN_RATEはlib/members.tsに定義（現在は未使用）
