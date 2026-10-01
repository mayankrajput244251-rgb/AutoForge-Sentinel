import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const batchSessions = sqliteTable(
  "batch_sessions",
  {
    id: text("id").primaryKey(),
    clientKey: text("client_key").notNull(),
    batchNumber: integer("batch_number").notNull(),
    status: text("status").notNull(),
    totalPackets: integer("total_packets").notNull(),
    passedPackets: integer("passed_packets").notNull(),
    warningPackets: integer("warning_packets").notNull(),
    rejectedPackets: integer("rejected_packets").notNull(),
    oee: integer("oee").notNull(),
    lastRisk: integer("last_risk").notNull(),
    eventCount: integer("event_count").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_batch_sessions_client_updated").on(table.clientKey, table.updatedAt)],
);

export const packetRecords = sqliteTable(
  "packet_records",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    packetNo: integer("packet_no").notNull(),
    scannedAt: text("scanned_at").notNull(),
    rpm: integer("rpm").notNull(),
    vibration: text("vibration").notNull(),
    temperature: text("temperature").notNull(),
    current: text("current").notNull(),
    aiResult: text("ai_result").notNull(),
    autoAction: text("auto_action").notNull(),
    risk: integer("risk").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_packet_records_session_packet").on(table.sessionId, table.packetNo),
    index("idx_packet_records_session_created").on(table.sessionId, table.createdAt),
  ],
);

export const eventRecords = sqliteTable(
  "event_records",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    eventTime: text("event_time").notNull(),
    level: text("level").notNull(),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_event_records_session_created").on(table.sessionId, table.createdAt)],
);

export const maintenanceWorkOrders = sqliteTable(
  "maintenance_work_orders",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    action: text("action").notNull(),
    repairTime: text("repair_time").notNull(),
    maintenanceWindow: text("maintenance_window").notNull(),
    severity: text("severity").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_work_orders_session_created").on(table.sessionId, table.createdAt)],
);
