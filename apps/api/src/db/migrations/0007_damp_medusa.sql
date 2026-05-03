ALTER TABLE "user_preferences" ALTER COLUMN "date_format" SET DEFAULT 'DD/MM/YYYY';--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "timezone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "timezone" DROP NOT NULL;