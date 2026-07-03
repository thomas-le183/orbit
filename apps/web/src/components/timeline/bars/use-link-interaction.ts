import type { DependencyType } from "@orbit/shared";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Anchor } from "../dependencies/geometry";
import { useEdgeAutoScroll } from "./use-edge-autoscroll";

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
	/** Valid drop target currently under the cursor (a different task's node). */
	over: LinkEndpoint | null;
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
	const edgeScroll = useEdgeAutoScroll();
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

	const beginLink = useCallback(
		(e: ReactPointerEvent, from: LinkEndpoint) => {
			if (activeRef.current) return;
			e.stopPropagation();
			e.preventDefault();
			const captureTarget = e.currentTarget;
			try {
				captureTarget.setPointerCapture(e.pointerId);
			} catch {}
			// Valid drop target under the cursor: a node belonging to a DIFFERENT task.
			const targetAt = (x: number, y: number): LinkEndpoint | null => {
				const t = resolveLinkTarget(document.elementFromPoint(x, y));
				return t && t.taskId !== from.taskId ? t : null;
			};

			setLinkDraft({
				from,
				pointer: { x: e.clientX, y: e.clientY },
				over: null,
			});

			// Latest cursor position, so the auto-scroll loop can re-run the drop-target
			// hit test as new bars scroll under a stationary cursor.
			let lastX = e.clientX;
			let lastY = e.clientY;

			const onMove = (ev: PointerEvent) => {
				lastX = ev.clientX;
				lastY = ev.clientY;
				edgeScroll.setPointer(ev.clientX, ev.clientY);
				setLinkDraft({
					from,
					pointer: { x: ev.clientX, y: ev.clientY },
					over: targetAt(ev.clientX, ev.clientY),
				});
			};
			const onUp = (ev: PointerEvent) => {
				edgeScroll.stop();
				const target = targetAt(ev.clientX, ev.clientY);
				if (target) {
					optsRef.current.onCreate(from, target);
				}
				setLinkDraft(null);
				try {
					captureTarget.releasePointerCapture(ev.pointerId);
				} catch {}
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				activeRef.current = null;
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			activeRef.current = { move: onMove, up: onUp };
			// Dragging a link toward a viewport edge scrolls the timeline so off-screen
			// tasks can be reached; the connector end stays under the cursor.
			edgeScroll.start(e.clientX, e.clientY, () => {
				setLinkDraft((prev) =>
					prev ? { ...prev, over: targetAt(lastX, lastY) } : prev,
				);
			});
		},
		[edgeScroll.start, edgeScroll.stop, edgeScroll.setPointer],
	);

	return { linkDraft, beginLink };
}
