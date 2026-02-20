CREATE TYPE "public"."author_type" AS ENUM('human', 'agent');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('triage', 'backlog', 'todo', 'in_progress', 'done', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('signal', 'hypothesis', 'plan', 'task', 'monitor');--> statement-breakpoint
CREATE TYPE "public"."relation_type" AS ENUM('blocks', 'blocked_by', 'related', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'achieved', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."project_health" AS ENUM('on_track', 'at_risk', 'off_track');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('backlog', 'planned', 'active', 'paused', 'completed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."signal_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."prompt_version_status" AS ENUM('active', 'draft', 'retired');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"issue_id" text NOT NULL,
	"author_name" text NOT NULL,
	"author_type" "author_type" NOT NULL,
	"parent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_labels" (
	"issue_id" text NOT NULL,
	"label_id" text NOT NULL,
	CONSTRAINT "issue_labels_issue_id_label_id_pk" PRIMARY KEY("issue_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "issue_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "relation_type" NOT NULL,
	"issue_id" text NOT NULL,
	"related_issue_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" text PRIMARY KEY NOT NULL,
	"number" serial NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "issue_type" NOT NULL,
	"status" "issue_status" DEFAULT 'triage' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"parent_id" text,
	"project_id" text,
	"signal_source" text,
	"signal_payload" jsonb,
	"hypothesis" jsonb,
	"agent_session_id" text,
	"agent_summary" text,
	"commits" jsonb,
	"pull_requests" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "issues_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "labels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"metric" text,
	"target_value" double precision,
	"current_value" double precision,
	"unit" text,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"project_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'backlog' NOT NULL,
	"health" "project_health" DEFAULT 'on_track' NOT NULL,
	"goal_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"type" text NOT NULL,
	"severity" "signal_severity" NOT NULL,
	"payload" jsonb NOT NULL,
	"issue_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"clarity" integer NOT NULL,
	"completeness" integer NOT NULL,
	"relevance" integer NOT NULL,
	"feedback" text,
	"author_type" "author_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_clarity_range" CHECK ("prompt_reviews"."clarity" BETWEEN 1 AND 5),
	CONSTRAINT "chk_completeness_range" CHECK ("prompt_reviews"."completeness" BETWEEN 1 AND 5),
	CONSTRAINT "chk_relevance_range" CHECK ("prompt_reviews"."relevance" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"specificity" integer DEFAULT 10 NOT NULL,
	"project_id" text,
	"active_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "prompt_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"changelog" text,
	"author_type" "author_type" NOT NULL,
	"author_name" text NOT NULL,
	"status" "prompt_version_status" DEFAULT 'draft' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" double precision,
	"avg_duration_ms" double precision,
	"review_score" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_prompt_versions_template_version" UNIQUE("template_id","version")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_reviews" ADD CONSTRAINT "prompt_reviews_version_id_prompt_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_template_id_prompt_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_comments_issue_id" ON "comments" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "idx_issue_relations_issue_id" ON "issue_relations" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "idx_issue_relations_related_issue_id" ON "issue_relations" USING btree ("related_issue_id");--> statement-breakpoint
CREATE INDEX "idx_issues_project_status" ON "issues" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_issues_parent_id" ON "issues" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_issues_type" ON "issues" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_issues_status" ON "issues" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_issues_number" ON "issues" USING btree ("number");--> statement-breakpoint
CREATE INDEX "idx_signals_issue_id" ON "signals" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "idx_signals_source" ON "signals" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_signals_payload_gin" ON "signals" USING btree ("payload");--> statement-breakpoint
CREATE INDEX "idx_prompt_reviews_version_id" ON "prompt_reviews" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_versions_template_id" ON "prompt_versions" USING btree ("template_id");