// Success response with data
export type ApiSuccess<T> = {
	success: true;
	data: T;
};

// Error response
export type ApiResponseError = {
	success: false;
	error: {
		code: string;
		message: string;
	};
};

// Union — use this as the return type for all API calls
export type ApiResponse<T> = ApiSuccess<T> | ApiResponseError;

// Paginated success response (cursor-based)
export type PaginatedData<T> = {
	items: T[];
	nextCursor: string | null;
	prevCursor: string | null;
};

export type PaginatedResponse<T> =
	| ApiSuccess<PaginatedData<T>>
	| ApiResponseError;

// Narrowing helpers
export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccess<T> {
	return res.success === true;
}

export function isApiResponseError<T>(
	res: ApiResponse<T>,
): res is ApiResponseError {
	return res.success === false;
}
