// Success response with data
export type ApiSuccess<T> = {
	success: true
	data: T
}

// Error response
export type ApiError = {
	success: false
	error: {
		code: string
		message: string
	}
}

// Union — use this as the return type for all API calls
export type ApiResponse<T> = ApiSuccess<T> | ApiError

// Paginated success response (cursor-based)
export type PaginatedData<T> = {
	items: T[]
	nextCursor: string | null
	prevCursor: string | null
}

export type PaginatedResponse<T> = ApiSuccess<PaginatedData<T>> | ApiError

// Narrowing helpers
export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccess<T> {
	return res.success === true
}

export function isApiError<T>(res: ApiResponse<T>): res is ApiError {
	return res.success === false
}
