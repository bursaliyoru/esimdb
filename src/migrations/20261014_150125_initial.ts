import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_scope" AS ENUM('single', 'regional', 'global');
  CREATE TYPE "public"."enum_plans_source" AS ENUM('scraper', 'manual', 'seed');
  CREATE TYPE "public"."enum_coupons_discount_type" AS ENUM('percent', 'fixed', 'other');
  CREATE TYPE "public"."enum_rankings_mode" AS ENUM('hybrid', 'auto', 'manual');
  CREATE TYPE "public"."enum_reviews_source" AS ENUM('site', 'trustpilot');
  CREATE TYPE "public"."enum_reviews_status" AS ENUM('pending', 'approved', 'rejected');
  CREATE TYPE "public"."enum_scrape_runs_status" AS ENUM('running', 'ok', 'failed');
  CREATE TABLE "providers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"active" boolean DEFAULT true,
  	"website" varchar NOT NULL,
  	"affiliate_url" varchar,
  	"brand_color" varchar DEFAULT '#0B2027',
  	"logo_id" integer,
  	"logo_url" varchar,
  	"tagline" varchar,
  	"description" varchar,
  	"headquarters" varchar,
  	"founded" numeric,
  	"has_app" boolean DEFAULT true,
  	"top_up" boolean DEFAULT true,
  	"hotspot" boolean DEFAULT true,
  	"phone_number" boolean DEFAULT false,
  	"kyc" varchar,
  	"trustpilot_domain" varchar,
  	"trust_score" numeric,
  	"trust_review_count" numeric,
  	"trust_updated_at" timestamp(3) with time zone,
  	"scraper" varchar,
  	"last_scraped_at" timestamp(3) with time zone,
  	"last_scrape_status" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"provider_id" integer NOT NULL,
  	"external_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"scope" "enum_plans_scope" DEFAULT 'single' NOT NULL,
  	"region_id" integer,
  	"data_mb" numeric,
  	"daily_mb" numeric,
  	"validity_days" numeric NOT NULL,
  	"price_usd" numeric NOT NULL,
  	"original_price_usd" numeric,
  	"price" numeric,
  	"currency" varchar DEFAULT 'USD',
  	"network" varchar,
  	"five_g" boolean DEFAULT false,
  	"hotspot" boolean DEFAULT true,
  	"phone_number" boolean DEFAULT false,
  	"new_users_only" boolean DEFAULT false,
  	"url" varchar,
  	"active" boolean DEFAULT true,
  	"last_seen_at" timestamp(3) with time zone,
  	"source" "enum_plans_source" DEFAULT 'manual',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "plans_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"countries_id" integer
  );
  
  CREATE TABLE "countries_networks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "countries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"iso2" varchar NOT NULL,
  	"flag" varchar,
  	"popular" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "countries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"regions_id" integer
  );
  
  CREATE TABLE "regions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"country_count" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider_id" integer NOT NULL,
  	"code" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"discount_type" "enum_coupons_discount_type" DEFAULT 'percent',
  	"discount_value" numeric,
  	"discount_label" varchar,
  	"terms" varchar,
  	"starts_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"verified_at" timestamp(3) with time zone,
  	"exclusive" boolean DEFAULT false,
  	"new_users_only" boolean DEFAULT false,
  	"url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rankings_entries_pros" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "rankings_entries_cons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "rankings_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"provider_id" integer NOT NULL,
  	"pinned_position" numeric,
  	"excluded" boolean DEFAULT false,
  	"sponsored" boolean DEFAULT false,
  	"badge" varchar,
  	"note" varchar
  );
  
  CREATE TABLE "rankings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"country_id" integer,
  	"intro" varchar,
  	"mode" "enum_rankings_mode" DEFAULT 'hybrid',
  	"size" numeric DEFAULT 10,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider_id" integer NOT NULL,
  	"source" "enum_reviews_source" DEFAULT 'site' NOT NULL,
  	"status" "enum_reviews_status" DEFAULT 'pending' NOT NULL,
  	"rating" numeric NOT NULL,
  	"title" varchar,
  	"body" varchar NOT NULL,
  	"author_name" varchar NOT NULL,
  	"author_country" varchar,
  	"author_email" varchar,
  	"published_at" timestamp(3) with time zone NOT NULL,
  	"external_id" varchar,
  	"external_url" varchar,
  	"ip_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "price_snapshots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"plan_id" integer NOT NULL,
  	"price_usd" numeric NOT NULL,
  	"captured_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scrape_runs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"job" varchar NOT NULL,
  	"status" "enum_scrape_runs_status" NOT NULL,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"finished_at" timestamp(3) with time zone,
  	"items_found" numeric,
  	"items_changed" numeric,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "clicks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"provider_id" integer NOT NULL,
  	"plan_id" integer,
  	"source" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"providers_id" integer,
  	"plans_id" integer,
  	"countries_id" integer,
  	"regions_id" integer,
  	"coupons_id" integer,
  	"rankings_id" integer,
  	"reviews_id" integer,
  	"price_snapshots_id" integer,
  	"scrape_runs_id" integer,
  	"clicks_id" integer,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "providers" ADD CONSTRAINT "providers_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plans" ADD CONSTRAINT "plans_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plans" ADD CONSTRAINT "plans_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plans_rels" ADD CONSTRAINT "plans_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "plans_rels" ADD CONSTRAINT "plans_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "countries_networks" ADD CONSTRAINT "countries_networks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "countries_rels" ADD CONSTRAINT "countries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "countries_rels" ADD CONSTRAINT "countries_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons" ADD CONSTRAINT "coupons_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rankings_entries_pros" ADD CONSTRAINT "rankings_entries_pros_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rankings_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rankings_entries_cons" ADD CONSTRAINT "rankings_entries_cons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rankings_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rankings_entries" ADD CONSTRAINT "rankings_entries_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rankings_entries" ADD CONSTRAINT "rankings_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rankings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rankings" ADD CONSTRAINT "rankings_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clicks" ADD CONSTRAINT "clicks_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clicks" ADD CONSTRAINT "clicks_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_providers_fk" FOREIGN KEY ("providers_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_countries_fk" FOREIGN KEY ("countries_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("coupons_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rankings_fk" FOREIGN KEY ("rankings_id") REFERENCES "public"."rankings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_price_snapshots_fk" FOREIGN KEY ("price_snapshots_id") REFERENCES "public"."price_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scrape_runs_fk" FOREIGN KEY ("scrape_runs_id") REFERENCES "public"."scrape_runs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clicks_fk" FOREIGN KEY ("clicks_id") REFERENCES "public"."clicks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "providers_slug_idx" ON "providers" USING btree ("slug");
  CREATE INDEX "providers_logo_idx" ON "providers" USING btree ("logo_id");
  CREATE INDEX "providers_updated_at_idx" ON "providers" USING btree ("updated_at");
  CREATE INDEX "providers_created_at_idx" ON "providers" USING btree ("created_at");
  CREATE UNIQUE INDEX "plans_key_idx" ON "plans" USING btree ("key");
  CREATE INDEX "plans_provider_idx" ON "plans" USING btree ("provider_id");
  CREATE INDEX "plans_region_idx" ON "plans" USING btree ("region_id");
  CREATE INDEX "plans_price_usd_idx" ON "plans" USING btree ("price_usd");
  CREATE INDEX "plans_active_idx" ON "plans" USING btree ("active");
  CREATE INDEX "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX "plans_created_at_idx" ON "plans" USING btree ("created_at");
  CREATE INDEX "plans_rels_order_idx" ON "plans_rels" USING btree ("order");
  CREATE INDEX "plans_rels_parent_idx" ON "plans_rels" USING btree ("parent_id");
  CREATE INDEX "plans_rels_path_idx" ON "plans_rels" USING btree ("path");
  CREATE INDEX "plans_rels_countries_id_idx" ON "plans_rels" USING btree ("countries_id");
  CREATE INDEX "countries_networks_order_idx" ON "countries_networks" USING btree ("_order");
  CREATE INDEX "countries_networks_parent_id_idx" ON "countries_networks" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "countries_slug_idx" ON "countries" USING btree ("slug");
  CREATE UNIQUE INDEX "countries_iso2_idx" ON "countries" USING btree ("iso2");
  CREATE INDEX "countries_updated_at_idx" ON "countries" USING btree ("updated_at");
  CREATE INDEX "countries_created_at_idx" ON "countries" USING btree ("created_at");
  CREATE INDEX "countries_rels_order_idx" ON "countries_rels" USING btree ("order");
  CREATE INDEX "countries_rels_parent_idx" ON "countries_rels" USING btree ("parent_id");
  CREATE INDEX "countries_rels_path_idx" ON "countries_rels" USING btree ("path");
  CREATE INDEX "countries_rels_regions_id_idx" ON "countries_rels" USING btree ("regions_id");
  CREATE UNIQUE INDEX "regions_slug_idx" ON "regions" USING btree ("slug");
  CREATE INDEX "regions_updated_at_idx" ON "regions" USING btree ("updated_at");
  CREATE INDEX "regions_created_at_idx" ON "regions" USING btree ("created_at");
  CREATE INDEX "coupons_provider_idx" ON "coupons" USING btree ("provider_id");
  CREATE INDEX "coupons_updated_at_idx" ON "coupons" USING btree ("updated_at");
  CREATE INDEX "coupons_created_at_idx" ON "coupons" USING btree ("created_at");
  CREATE INDEX "rankings_entries_pros_order_idx" ON "rankings_entries_pros" USING btree ("_order");
  CREATE INDEX "rankings_entries_pros_parent_id_idx" ON "rankings_entries_pros" USING btree ("_parent_id");
  CREATE INDEX "rankings_entries_cons_order_idx" ON "rankings_entries_cons" USING btree ("_order");
  CREATE INDEX "rankings_entries_cons_parent_id_idx" ON "rankings_entries_cons" USING btree ("_parent_id");
  CREATE INDEX "rankings_entries_order_idx" ON "rankings_entries" USING btree ("_order");
  CREATE INDEX "rankings_entries_parent_id_idx" ON "rankings_entries" USING btree ("_parent_id");
  CREATE INDEX "rankings_entries_provider_idx" ON "rankings_entries" USING btree ("provider_id");
  CREATE UNIQUE INDEX "rankings_slug_idx" ON "rankings" USING btree ("slug");
  CREATE INDEX "rankings_country_idx" ON "rankings" USING btree ("country_id");
  CREATE INDEX "rankings_updated_at_idx" ON "rankings" USING btree ("updated_at");
  CREATE INDEX "rankings_created_at_idx" ON "rankings" USING btree ("created_at");
  CREATE INDEX "reviews_provider_idx" ON "reviews" USING btree ("provider_id");
  CREATE INDEX "reviews_source_idx" ON "reviews" USING btree ("source");
  CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");
  CREATE UNIQUE INDEX "reviews_external_id_idx" ON "reviews" USING btree ("external_id");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  CREATE INDEX "price_snapshots_plan_idx" ON "price_snapshots" USING btree ("plan_id");
  CREATE INDEX "price_snapshots_updated_at_idx" ON "price_snapshots" USING btree ("updated_at");
  CREATE INDEX "price_snapshots_created_at_idx" ON "price_snapshots" USING btree ("created_at");
  CREATE INDEX "scrape_runs_updated_at_idx" ON "scrape_runs" USING btree ("updated_at");
  CREATE INDEX "scrape_runs_created_at_idx" ON "scrape_runs" USING btree ("created_at");
  CREATE INDEX "clicks_provider_idx" ON "clicks" USING btree ("provider_id");
  CREATE INDEX "clicks_plan_idx" ON "clicks" USING btree ("plan_id");
  CREATE INDEX "clicks_updated_at_idx" ON "clicks" USING btree ("updated_at");
  CREATE INDEX "clicks_created_at_idx" ON "clicks" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_providers_id_idx" ON "payload_locked_documents_rels" USING btree ("providers_id");
  CREATE INDEX "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");
  CREATE INDEX "payload_locked_documents_rels_countries_id_idx" ON "payload_locked_documents_rels" USING btree ("countries_id");
  CREATE INDEX "payload_locked_documents_rels_regions_id_idx" ON "payload_locked_documents_rels" USING btree ("regions_id");
  CREATE INDEX "payload_locked_documents_rels_coupons_id_idx" ON "payload_locked_documents_rels" USING btree ("coupons_id");
  CREATE INDEX "payload_locked_documents_rels_rankings_id_idx" ON "payload_locked_documents_rels" USING btree ("rankings_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "payload_locked_documents_rels_price_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("price_snapshots_id");
  CREATE INDEX "payload_locked_documents_rels_scrape_runs_id_idx" ON "payload_locked_documents_rels" USING btree ("scrape_runs_id");
  CREATE INDEX "payload_locked_documents_rels_clicks_id_idx" ON "payload_locked_documents_rels" USING btree ("clicks_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "providers" CASCADE;
  DROP TABLE "plans" CASCADE;
  DROP TABLE "plans_rels" CASCADE;
  DROP TABLE "countries_networks" CASCADE;
  DROP TABLE "countries" CASCADE;
  DROP TABLE "countries_rels" CASCADE;
  DROP TABLE "regions" CASCADE;
  DROP TABLE "coupons" CASCADE;
  DROP TABLE "rankings_entries_pros" CASCADE;
  DROP TABLE "rankings_entries_cons" CASCADE;
  DROP TABLE "rankings_entries" CASCADE;
  DROP TABLE "rankings" CASCADE;
  DROP TABLE "reviews" CASCADE;
  DROP TABLE "price_snapshots" CASCADE;
  DROP TABLE "scrape_runs" CASCADE;
  DROP TABLE "clicks" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_plans_scope";
  DROP TYPE "public"."enum_plans_source";
  DROP TYPE "public"."enum_coupons_discount_type";
  DROP TYPE "public"."enum_rankings_mode";
  DROP TYPE "public"."enum_reviews_source";
  DROP TYPE "public"."enum_reviews_status";
  DROP TYPE "public"."enum_scrape_runs_status";`)
}
