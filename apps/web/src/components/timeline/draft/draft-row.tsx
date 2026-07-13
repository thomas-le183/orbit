import { cn } from "@orbit/shared";
import { Input } from "@orbit/ui/components/input";
import { Spinner } from "@orbit/ui/components/spinner";
import { PlusIcon } from "lucide-react";
import {
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useEdgeAutoScroll } from "../bars/use-edge-autoscroll";
import { useTimelineController } from "../controller/context";
import { type Geometry, pxPerMs } from "../controller/geometry";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import { usePublishDragRange } from "../drag/context";
import { ROW_HEIGHT, ROW_PADDING } from "../layout/row-metrics";
import { ONE_DAY, startOfUtcDay } from "../units/make-units";
import {
	CLICK_THRESHOLD_PX,
	draftRangeFromDrag,
	draftRangeToOffset,
} from "./draft-range";
import { useDraftTask } from "./use-draft-task";

/** Inline name input + date readout, aligned to a TimelineTable row. */
export function DraftTableCell({ rowIndex }: { rowIndex: number }) {
	const {
		inputRef,
		name,
		startDate,
		endDate,
		isPending,
		setName,
		commit,
		cancel,
	} = useDraftTask();
	const top = rowIndex * ROW_HEIGHT;
	return (
		<div
			data-testid="timeline-draft-row"
			className="absolute inset-x-0 flex items-center gap-2 px-3 text-xs"
			style={{ top, height: ROW_HEIGHT }}
		>
			{isPending ? (
				<Spinner className="size-4 shrink-0 text-muted-foreground" />
			) : (
				<PlusIcon className="size-4 shrink-0 text-muted-foreground" />
			)}
			<span className="flex min-w-0 flex-1 items-center gap-1.5">
				{/* Warning slot spacer — keeps the name aligned with warned rows. */}
				<span className="size-3.5 shrink-0" aria-hidden />
				{/* Color-dot slot spacer — keeps the input aligned with real task names. */}
				<span className="size-2 shrink-0" aria-hidden />
				<Input
					ref={inputRef}
					aria-label="New task name"
					placeholder="Add task…"
					value={name}
					disabled={isPending}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commit();
						} else if (e.key === "Escape") {
							e.preventDefault();
							cancel();
						}
					}}
					className="h-6 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
				/>
			</span>
			<span className="w-24 shrink-0" />
			<span className="w-28 shrink-0 truncate text-muted-foreground">
				{startDate && endDate ? `${startDate} → ${endDate}` : "No dates"}
			</span>
		</div>
	);
}

/** Drag surface that sketches a date range and renders a dashed ghost bar. */
export function DraftLane({ rowIndex }: { rowIndex: number }) {
	const { today, offsetMs, zoomLevel, viewportWidth } = useTimelineController();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { startDate, endDate, setDates, focusInput, cancel } = useDraftTask();
	// Cursor x while the create-drag is live; null once released, which also
	// stops the header feedback (the dashed ghost stays until commit/cancel).
	const [pointerX, setPointerX] = useState<number | null>(null);
	// Horizontal only: the draft lane is a fixed row, so scrolling rows mid-drag
	// would only disorient.
	const edgeScroll = useEdgeAutoScroll({ vertical: false });

	// Tint the spanned day cells / pin the date label, exactly as a bar drag does.
	// Memoized: the publisher keys its effect on range identity.
	const dragRange = useMemo(
		() =>
			pointerX == null ? null : draftRangeToOffset(startDate, endDate, today),
		[pointerX, startDate, endDate, today],
	);
	usePublishDragRange(dragRange, pointerX);

	const listenersRef = useRef<{
		move: (e: PointerEvent) => void;
		up: (e: PointerEvent) => void;
		key: (e: KeyboardEvent) => void;
	} | null>(null);

	useEffect(() => {
		return () => {
			if (listenersRef.current) {
				window.removeEventListener("pointermove", listenersRef.current.move);
				window.removeEventListener("pointerup", listenersRef.current.up);
				window.removeEventListener("keydown", listenersRef.current.key, true);
				listenersRef.current = null;
			}
		};
	}, []);

	const top = rowIndex * ROW_HEIGHT;
	const geom: Geometry = { offsetMs, zoom: zoomLevel, viewportWidth };

	const beginDrag = (e: ReactPointerEvent) => {
		if (listenersRef.current) return;
		e.preventDefault();
		const rect = e.currentTarget.getBoundingClientRect();
		const startX = e.clientX;
		const startY = e.clientY;
		// Time panned under the cursor since the press. Geometry is frozen at
		// press-time so the anchor day stays pinned to the content while the
		// viewport scrolls; only the moving end absorbs the pan.
		let panAccumMs = 0;
		const geom0 = geom;
		let lastX = startX;

		const apply = (clientX: number) => {
			const r = draftRangeFromDrag(
				startX,
				clientX + panAccumMs * pxPerMs(geom0.zoom),
				rect,
				geom0,
				today,
			);
			setDates(r.startDate, r.endDate);
			setPointerX(clientX);
		};
		apply(startX);
		const onMove = (ev: PointerEvent) => {
			lastX = ev.clientX;
			// Only once the press reads as a drag; a click near the edge must not
			// pan the timeline out from under the user.
			if (Math.abs(ev.clientX - startX) >= CLICK_THRESHOLD_PX) {
				edgeScroll.start(ev.clientX, startY, (panMs) => {
					panAccumMs += panMs;
					apply(lastX);
				});
				edgeScroll.setPointer(ev.clientX, startY);
			}
			apply(ev.clientX);
		};
		/** Ends the gesture. Leaves the sketched dates alone — callers decide. */
		const teardown = () => {
			edgeScroll.stop();
			setPointerX(null);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("keydown", onKey, true);
			listenersRef.current = null;
		};

		const onUp = (ev: PointerEvent) => {
			apply(ev.clientX);
			teardown();
			focusInput();
		};

		// Escape abandons the whole draft — gesture, ghost, and any typed name.
		// Tearing down first means the later pointerup lands on no listener, so
		// the abandoned range can never be re-applied.
		const onKey = (ev: KeyboardEvent) => {
			if (ev.key !== "Escape") return;
			ev.preventDefault();
			ev.stopPropagation();
			teardown();
			cancel();
		};

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		// Capture phase: beat the view-level Escape handler that clears selection.
		window.addEventListener("keydown", onKey, true);
		listenersRef.current = { move: onMove, up: onUp, key: onKey };
	};

	let ghost: ReactNode = null;
	if (startDate && endDate) {
		const left = getPercentageOffset(
			startOfUtcDay(Date.parse(startDate)) - today,
		);
		const right = getPercentageOffset(
			startOfUtcDay(Date.parse(endDate)) - today + ONE_DAY,
		);
		if (Number.isFinite(left) && Number.isFinite(right)) {
			ghost = (
				<span
					data-testid="timeline-draft-preview"
					className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary/60 bg-primary/15"
					style={{
						left: `${left}%`,
						width: `${Math.max(right - left, 0)}%`,
						top: ROW_PADDING,
						height: ROW_HEIGHT - ROW_PADDING * 2,
					}}
				/>
			);
		} else {
			ghost = <span data-testid="timeline-draft-preview" className="hidden" />;
		}
	}

	return (
		<div
			data-testid="timeline-draft-lane"
			onPointerDown={beginDrag}
			className={cn("pointer-events-auto absolute inset-x-0")}
			style={{ top, height: ROW_HEIGHT }}
		>
			{ghost}
		</div>
	);
}
