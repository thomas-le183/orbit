import axios from "axios";
import { useCallback } from "react";
import { api } from "@/lib/api";

interface PresignResponse {
	uploadUrl: string;
	storageKey: string;
	publicUrl: string;
}

export function useUploadFile() {
	const upload = useCallback(
		async (
			file: File,
			purpose: "avatar" | "logo",
			orgId?: string,
		): Promise<string> => {
			const { data } = await api.post<PresignResponse>("/uploads/presign", {
				fileName: file.name,
				mimeType: file.type,
				fileSize: file.size,
				purpose,
				orgId,
			});

			// Content-Length is intentionally omitted: the presigned URL was generated without
			// signing ContentLength, so Axios derives it from the body. If the server ever
			// switches to signing ContentLength, add "Content-Length": String(file.size) here.
			await axios.put(data.uploadUrl, file, {
				headers: { "Content-Type": file.type },
			});

			return data.publicUrl;
		},
		[],
	);

	return { upload };
}
