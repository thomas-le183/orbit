import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiError } from "./api-types";
import { isApiError } from "./api-types";

declare module "@tanstack/react-query" {
	interface Register {
		defaultError: ApiError;
	}
}

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error) => {
			if (isApiError(error) && error.statusCode !== 401) {
				toast.error(error.message);
			}
		},
	}),
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000,
			retry: false,
		},
	},
});
