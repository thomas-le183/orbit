import axios from "axios";
import { api } from "@/lib/api";

interface PresignResponse {
	uploadUrl: string;
	storageKey: string;
	publicUrl: string;
}

export function useUploadFile() {
	async function upload(
		file: File,
		purpose: "avatar" | "logo",
		orgId?: string,
	): Promise<string> {
		const { data } = await api.post<PresignResponse>("/uploads/presign", {
			fileName: file.name,
			mimeType: file.type,
			fileSize: file.size,
			purpose,
			orgId,
		});

		await axios.put(data.uploadUrl, file, {
			headers: { "Content-Type": file.type },
		});

		return data.publicUrl;
	}

	return { upload };
}
