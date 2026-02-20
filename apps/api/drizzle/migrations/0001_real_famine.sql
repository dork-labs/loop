DROP INDEX "idx_signals_payload_gin";--> statement-breakpoint
CREATE INDEX "idx_signals_payload_gin" ON "signals" USING gin ("payload");