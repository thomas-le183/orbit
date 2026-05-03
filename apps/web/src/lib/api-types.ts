export type ApiError = {
	statusCode: number;
	message: string;
	code: string;
};

export function isApiError(err: unknown): err is ApiError {
	return (
		typeof err === "object" &&
		err !== null &&
		typeof (err as Record<string, unknown>).statusCode === "number" &&
		typeof (err as Record<string, unknown>).message === "string" &&
		typeof (err as Record<string, unknown>).code === "string"
	);
}
