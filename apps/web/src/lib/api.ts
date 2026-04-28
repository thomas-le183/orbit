import axios from "axios";

export type ApiError = {
	statusCode: number;
	message: string;
	error?: string;
};

export const api = axios.create({
	baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
	withCredentials: true,
});

api.interceptors.response.use(
	(response) => response,
	(err) => {
		const data = err?.response?.data;
		if (data && typeof data === "object" && "statusCode" in data) {
			return Promise.reject(data as ApiError);
		}
		return Promise.reject(err);
	},
);
