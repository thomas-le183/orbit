import { QueryClient } from "@tanstack/react-query";
import type { ApiError } from "./api";

declare module "@tanstack/react-query" {
	interface Register {
		defaultError: ApiError;
	}
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000,
			retry: false,
		},
	},
});
