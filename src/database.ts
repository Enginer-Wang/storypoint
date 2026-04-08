import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "..", "data", "story_point.db");

let dbInstance: sqlite3.Database | null = null;

// 辅助函数：将回调 API 转换为 Promise
function runAsync(
  db: sqlite3.Database,
  sql: string,
  params: any[] = []
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export const db = {
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      dbInstance = new sqlite3.Database(dbPath, async (err: Error | null) => {
        if (err) {
          console.error("Database connection failed:", err);
          reject(err);
        } else {
          console.log("Connected to SQLite database");
          try {
            await this.initializeTables();
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      });
    });
  },

  async initializeTables(): Promise<void> {
    if (!dbInstance) {
      throw new Error("Database not connected");
    }

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        story_id TEXT NOT NULL,
        qr_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'active'
      )
    `;

    const createSubmissionsTable = `
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        participant_id TEXT NOT NULL,
        participant_name TEXT NOT NULL,
        role TEXT NOT NULL,
        points INTEGER NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `;

    const createResultsTable = `
      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        story_id TEXT NOT NULL,
        final_points INTEGER,
        hours REAL,
        result_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `;

    const tables = [
      createSessionsTable,
      createSubmissionsTable,
      createResultsTable,
    ];

    for (const sql of tables) {
      await runAsync(dbInstance, sql);
    }

    // 添加 per-role final 列（已有表时安全添加）
    const alterCols = [
      "ALTER TABLE results ADD COLUMN fe_final INTEGER DEFAULT 0",
      "ALTER TABLE results ADD COLUMN be_final INTEGER DEFAULT 0",
      "ALTER TABLE results ADD COLUMN qa_final INTEGER DEFAULT 0",
    ];
    for (const sql of alterCols) {
      try { await runAsync(dbInstance, sql); } catch (_) { /* column already exists */ }
    }
  },

  async saveSession(
    sessionId: string,
    storyId: string,
    qrCode: string
  ): Promise<void> {
    if (!dbInstance) throw new Error("Database not connected");

    const sql = `
      INSERT INTO sessions (id, story_id, qr_code, status)
      VALUES (?, ?, ?, 'active')
    `;
    await runAsync(dbInstance, sql, [sessionId, storyId, qrCode]);
  },

  async savePointSubmission(
    sessionId: string,
    participantId: string,
    name: string,
    role: string,
    points: number
  ): Promise<void> {
    if (!dbInstance) throw new Error("Database not connected");

    const sql = `
      INSERT INTO submissions (id, session_id, participant_id, participant_name, role, points)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const id = randomUUID();
    await runAsync(dbInstance, sql, [
      id,
      sessionId,
      participantId,
      name,
      role,
      points,
    ]);
  },

  async saveFinalResult(
    sessionId: string,
    storyId: string,
    finalPoints: number,
    resultData: string
  ): Promise<void> {
    if (!dbInstance) throw new Error("Database not connected");

    const sql = `
      INSERT INTO results (id, session_id, story_id, final_points, result_data)
      VALUES (?, ?, ?, ?, ?)
    `;
    const id = randomUUID();
    await runAsync(dbInstance, sql, [
      id,
      sessionId,
      storyId,
      finalPoints,
      resultData,
    ]);
  },

  async updateFinalResult(
    sessionId: string,
    finalPoints: number,
    hours: number,
    feFinal: number = 0,
    beFinal: number = 0,
    qaFinal: number = 0
  ): Promise<void> {
    if (!dbInstance) throw new Error("Database not connected");

    const sql = `
      UPDATE results
      SET final_points = ?, hours = ?, fe_final = ?, be_final = ?, qa_final = ?
      WHERE session_id = ?
    `;
    await runAsync(dbInstance, sql, [finalPoints, hours, feFinal, beFinal, qaFinal, sessionId]);
  },

  async getHistory(): Promise<any[]> {
    if (!dbInstance) throw new Error("Database not connected");
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT r.session_id, r.story_id, r.final_points, r.hours, r.created_at,
               s.status
        FROM results r
        LEFT JOIN sessions s ON r.session_id = s.id
        ORDER BY r.created_at DESC
        LIMIT 100
      `;
      dbInstance!.all(sql, [], (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  async getHistoryDetail(sessionId: string): Promise<any> {
    if (!dbInstance) throw new Error("Database not connected");

    const getResult = (): Promise<any> => new Promise((resolve, reject) => {
      dbInstance!.get(
        `SELECT * FROM results WHERE session_id = ?`, [sessionId],
        (err: Error | null, row: any) => { if (err) reject(err); else resolve(row); }
      );
    });

    const getSubmissions = (): Promise<any[]> => new Promise((resolve, reject) => {
      dbInstance!.all(
        `SELECT participant_name, role, points, submitted_at FROM submissions WHERE session_id = ? ORDER BY submitted_at`,
        [sessionId],
        (err: Error | null, rows: any[]) => { if (err) reject(err); else resolve(rows || []); }
      );
    });

    const [result, submissions] = await Promise.all([getResult(), getSubmissions()]);
    if (!result) return null;

    // Build role stats from submissions
    const roleStats: { [key: string]: { points: number[]; average: number } } = {
      FE: { points: [], average: 0 },
      BE: { points: [], average: 0 },
      QA: { points: [], average: 0 },
    };
    submissions.forEach((s: any) => {
      if (roleStats[s.role]) roleStats[s.role].points.push(s.points);
    });
    Object.keys(roleStats).forEach(role => {
      const pts = roleStats[role].points;
      if (pts.length > 0) roleStats[role].average = pts.reduce((a, b) => a + b, 0) / pts.length;
    });

    return {
      sessionId: result.session_id,
      storyId: result.story_id,
      finalPoints: result.final_points,
      feFinal: result.fe_final || 0,
      beFinal: result.be_final || 0,
      qaFinal: result.qa_final || 0,
      hours: result.hours,
      createdAt: result.created_at,
      roleStats,
      participantDetails: submissions.map((s: any) => ({
        name: s.participant_name,
        role: s.role,
        points: s.points,
      })),
    };
  },

  async deleteHistory(sessionId: string): Promise<void> {
    if (!dbInstance) throw new Error("Database not connected");
    await runAsync(dbInstance, `DELETE FROM submissions WHERE session_id = ?`, [sessionId]);
    await runAsync(dbInstance, `DELETE FROM results WHERE session_id = ?`, [sessionId]);
    await runAsync(dbInstance, `DELETE FROM sessions WHERE id = ?`, [sessionId]);
  },

  async deleteParticipantSubmissions(
    sessionId: string,
    participantId: string
  ): Promise<void> {
    if (!dbInstance) throw new Error("Database not connected");
    await runAsync(
      dbInstance,
      `DELETE FROM submissions WHERE session_id = ? AND participant_id = ?`,
      [sessionId, participantId]
    );
  },

  async disconnect(): Promise<void> {
    if (dbInstance) {
      return new Promise((resolve, reject) => {
        dbInstance!.close((err: Error | null) => {
          if (err) reject(err);
          else {
            dbInstance = null;
            console.log("Disconnected from database");
            resolve();
          }
        });
      });
    }
  },
};
