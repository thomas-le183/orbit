const BASE_HOST = import.meta.env.VITE_BASE_HOST ?? "localhost";

export function getOrgSlug(): string | null {
	const hostname = window.location.hostname;
	if (hostname === BASE_HOST) return null;
	if (hostname.endsWith(`.${BASE_HOST}`)) {
		return hostname.slice(0, -`.${BASE_HOST}`.length);
	}
	return null;
}
