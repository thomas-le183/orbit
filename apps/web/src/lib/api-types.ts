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

export function getErrorMessage(err: unknown, fallback: string): string {
	if (isApiError(err)) return err.message;
	if (
		typeof err === "object" &&
		err !== null &&
		typeof (err as Record<string, unknown>).message === "string"
	) {
		return (err as Record<string, unknown>).message as string;
	}
	return fallback;
}
