CREATE TABLE IF NOT EXISTS Campaign (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channels TEXT NOT NULL,   -- JSON 배열로 저장 (SQLite엔 네이티브 배열/JSON 타입이 없음)
  objective TEXT NOT NULL,
  industry TEXT NOT NULL,
  status TEXT NOT NULL,
  dailyBudget INTEGER NOT NULL,
  targeting TEXT NOT NULL,  -- JSON 객체로 저장
  history TEXT NOT NULL,    -- JSON 배열로 저장
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
