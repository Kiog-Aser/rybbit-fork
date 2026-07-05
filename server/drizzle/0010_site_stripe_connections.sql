CREATE TABLE IF NOT EXISTS "site_stripe_connections" (
	"site_id" integer PRIMARY KEY NOT NULL,
	"restricted_key_encrypted" text NOT NULL,
	"webhook_secret" text,
	"stripe_account_id" text,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_stripe_connections" ADD CONSTRAINT "site_stripe_connections_site_id_sites_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;