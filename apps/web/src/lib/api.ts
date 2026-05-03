import axios from "axios";
import { router } from "./router";

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

export const api = axios.create({
	baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
	withCredentials: true,
});

api.interceptors.response.use(
	(response) => response,
	(err) => {
		const url: string = err?.config?.url ?? "";
		const data = err?.response?.data;

		if (err?.response?.status === 401 && !url.startsWith("/auth/")) {
			router.navigate({ to: "/login" });
			return Promise.reject(data as ApiError);
		}

		if (data && typeof data === "object" && "statusCode" in data) {
			return Promise.reject(data as ApiError);
		}

		return Promise.reject(err);
	},
);
