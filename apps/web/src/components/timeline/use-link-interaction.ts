import type { DependencyType } from "@orbit/shared";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Anchor } from "./dependencies/geometry";

export type LinkEndpoint = { taskId: string; anchor: Anchor };

export const anchorCode = (a: Anchor): "S" | "F" =>
	a === "finish" ? "F" : "S";

export const dependencyType = (from: Anchor, to: Anchor): DependencyType =>
	`${anchorCode(from)}${anchorCode(to)}` as DependencyType;

/** Nearest ancestor carrying `data-link-target`, read as a link endpoint. */
export function resolveLinkTarget(el: Element | null): LinkEndpoint | null {
	const node = el?.closest("[data-link-target]") as HTMLElement | null;
	if (!node) return null;
	const taskId = node.dataset.linkTarget;
	const anchor = node.dataset.linkAnchor as Anchor | undefined;
	if (!taskId || (anchor !== "start" && anchor !== "finish")) return null;
	return { taskId, anchor };
}

export type LinkDraft = {
	from: LinkEndpoint;
	pointer: { x: number; y: number };
};

/**
 * Pointer-driven dependency creation. Mirrors use-bar-interaction: window
 * listeners + capture, a single active gesture. Produces a live `linkDraft`
 * used to draw the ghost connector; on release, resolves the target under the
 * cursor and calls `onCreate` when it is a different task.
 */
export function useLinkInteraction(opts: {
	onCreate: (from: LinkEndpoint, to: LinkEndpoint) => void;
}): {
	linkDraft: LinkDraft | null;
	beginLink: (e: ReactPointerEvent, from: LinkEndpoint) => void;
} {
	const optsRef = useRef(opts);
	optsRef.current = opts;
	const activeRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
	} | null>(null);
	const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);

	useEffect(() => {
		return () => {
			if (activeRef.current) {
				window.removeEventListener("pointermove", activeRef.current.move);
				window.removeEventListener("pointerup", activeRef.current.up);
				activeRef.current = null;
			}
		};
	}, []);

	const beginLink = useCallback((e: ReactPointerEvent, from: LinkEndpoint) => {
		if (activeRef.current) return;
		e.stopPropagation();
		e.preventDefault();
		setLinkDraft({ from, pointer: { x: e.clientX, y: e.clientY } });

		const onMove = (ev: PointerEvent) => {
			setLinkDraft({ from, pointer: { x: ev.clientX, y: ev.clientY } });
		};
		const onUp = (ev: PointerEvent) => {
			const target = resolveLinkTarget(
				document.elementFromPoint(ev.clientX, ev.clientY),
			);
			if (target && target.taskId !== from.taskId) {
				optsRef.current.onCreate(from, target);
			}
			setLinkDraft(null);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			activeRef.current = null;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		activeRef.current = { move: onMove, up: onUp };
	}, []);

	return { linkDraft, beginLink };
}
