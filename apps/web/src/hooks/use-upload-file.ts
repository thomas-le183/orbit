import axios from "axios";
import { useCallback } from "react";
import { api } from "@/lib/api";

const MAX_AVATAR_PX = 512;

interface PresignResponse {
	uploadUrl: string;
	storageKey: string;
	publicUrl: string;
}

// Crops to a center square and resizes to maxPx × maxPx.
// GIFs are skipped (canvas flattens animation to a single frame).
function resizeToSquare(file: File, maxPx: number): Promise<File> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			const crop = Math.min(img.width, img.height);
			const out = Math.min(crop, maxPx);
			const canvas = document.createElement("canvas");
			canvas.width = out;
			canvas.height = out;
			const ctx = canvas.getContext("2d");
			if (!ctx) return reject(new Error("Could not get canvas context"));
			ctx.drawImage(
				img,
				(img.width - crop) / 2,
				(img.height - crop) / 2,
				crop,
				crop,
				0,
				0,
				out,
				out,
			);
			canvas.toBlob(
				(blob) => {
					if (!blob) return reject(new Error("Canvas toBlob failed"));
					resolve(new File([blob], file.name, { type: file.type }));
				},
				file.type,
				0.9,
			);
		};
		img.onerror = reject;
		img.src = url;
	});
}

export function useUploadFile() {
	const upload = useCallback(
		async (
			file: File,
			purpose: "avatar" | "logo",
			orgId?: string,
		): Promise<string> => {
			const toUpload =
				file.type !== "image/gif"
					? await resizeToSquare(file, MAX_AVATAR_PX)
					: file;

			const { data } = await api.post<PresignResponse>("/uploads/presign", {
				fileName: toUpload.name,
				mimeType: toUpload.type,
				fileSize: toUpload.size,
				purpose,
				orgId,
			});

			// Content-Length is intentionally omitted: the presigned URL was generated without
			// signing ContentLength, so Axios derives it from the body. If the server ever
			// switches to signing ContentLength, add "Content-Length": String(toUpload.size) here.
			await axios.put(data.uploadUrl, toUpload, {
				headers: { "Content-Type": toUpload.type },
			});

			return data.publicUrl;
		},
		[],
	);

	return { upload };
}
