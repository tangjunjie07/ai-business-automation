// Minimal local declaration for 'pg' when @types/pg is not installed.
// Provides a lightweight `Pool` class/type sufficient for server-side usage in this repo.
declare module 'pg' {
	export interface PoolConfig {
		connectionString?: string
		// allow additional props
		[key: string]: any
	}

	export class Pool {
		constructor(config?: PoolConfig)
		query(text: string, params?: any[]): Promise<any>
		connect(): Promise<any>
		end(): Promise<void>
	}

	export type PoolClient = any
}
