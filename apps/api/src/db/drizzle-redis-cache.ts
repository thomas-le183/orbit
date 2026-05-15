import { getTableName, is, Table } from "drizzle-orm";
import { Cache, type MutationOption } from "drizzle-orm/cache/core";
import type { CacheConfig } from "drizzle-orm/cache/core/types";
import type { Redis } from "ioredis";

const TABLE_KEY_PREFIX = "drizzle:table:";
const DEFAULT_TTL_SECONDS = 60;

export class DrizzleRedisCache extends Cache {
	constructor(
		private readonly redis: Redis,
		private readonly defaultTtl: number = DEFAULT_TTL_SECONDS,
	) {
		super();
	}

	override strategy(): "explicit" | "all" {
		return "explicit";
	}

	// biome-ignore lint/suspicious/noExplicitAny: must match abstract base class signature
	override async get(key: string, _tables: string[], _isTag: boolean, _isAutoInvalidate?: boolean): Promise<any[] | undefined> {
		const value = await this.redis.get(key);
		if (value === null) return undefined;
		return JSON.parse(value) as unknown[];
	}

	override async put(
		key: string,
		response: any,
		tables: string[],
		_isTag: boolean,
		config?: CacheConfig,
	): Promise<void> {
		const ttlMs = config?.px ?? (config?.ex ? config.ex * 1000 : this.defaultTtl * 1000);

		await this.redis.set(key, JSON.stringify(response), "PX", ttlMs);

		await Promise.all(
			tables.map((table) => this.redis.sadd(`${TABLE_KEY_PREFIX}${table}`, key)),
		);
	}

	override async onMutate(params: MutationOption): Promise<void> {
		const tags = params.tags ? (Array.isArray(params.tags) ? params.tags : [params.tags]) : [];
		const tables = params.tables
			? Array.isArray(params.tables)
				? params.tables
				: [params.tables]
			: [];

		const keysToDelete = new Set<string>();
		const tableSetKeys: string[] = [];

		for (const table of tables) {
			const tableName = is(table, Table) ? getTableName(table) : (table as string);
			const setKey = `${TABLE_KEY_PREFIX}${tableName}`;
			tableSetKeys.push(setKey);
			const keys = await this.redis.smembers(setKey);
			for (const k of keys) keysToDelete.add(k);
		}

		const allToDelete = [...keysToDelete, ...tableSetKeys, ...tags];
		if (allToDelete.length > 0) {
			await this.redis.del(...allToDelete);
		}
	}
}
