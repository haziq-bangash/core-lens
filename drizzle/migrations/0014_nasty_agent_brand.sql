CREATE TABLE "collection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"authors" json DEFAULT '[]'::json,
	"abstract" text,
	"year" integer,
	"doi" text,
	"journal" text,
	"source_url" text,
	"file_url" text,
	"file_name" text,
	"file_size_mb" real,
	"total_pages" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_collection" (
	"paper_id" text NOT NULL,
	"collection_id" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_tag" (
	"id" text PRIMARY KEY NOT NULL,
	"paper_id" text NOT NULL,
	"tag" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_index" ALTER COLUMN "chat_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document_index" ADD COLUMN "paper_id" text;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper" ADD CONSTRAINT "paper_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_collection" ADD CONSTRAINT "paper_collection_paper_id_paper_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."paper"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_collection" ADD CONSTRAINT "paper_collection_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_tag" ADD CONSTRAINT "paper_tag_paper_id_paper_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."paper"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_userId_idx" ON "collection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "paper_userId_idx" ON "paper" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "paper_doi_idx" ON "paper" USING btree ("doi");--> statement-breakpoint
CREATE INDEX "paper_status_idx" ON "paper" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pc_paperId_idx" ON "paper_collection" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "pc_collectionId_idx" ON "paper_collection" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "pt_paperId_idx" ON "paper_tag" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "pt_tag_idx" ON "paper_tag" USING btree ("tag");--> statement-breakpoint
ALTER TABLE "document_index" ADD CONSTRAINT "document_index_paper_id_paper_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."paper"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_index_paperId_idx" ON "document_index" USING btree ("paper_id");