import { useMemo, useRef } from "react";
import { useTimelineController } from "../controller/context";
import { useHorizontalPercentageOffset } from "../controller/hooks";
import { layoutItems } from "../controller/layout";
import { useTimelineData } from "../data/context";
import { contentHeight } from "../layout/row-metrics";
import { useVirtualRows } from "../layout/virtual-rows";
import type { RelativeTimeRangeOffset } from "../units/types";
import type { LinkDraft } from "../use-link-interaction";
import { type Anchor, elbowPath, rowCenterY } from "./geometry";

type RowInfo = { rowIndex: number; range: RelativeTimeRangeOffset };

export function DependencyLayer({
	draft,
	linkDraft,
}: {
	draft: Record<string, RelativeTimeRangeOffset>;
	linkDraft: LinkDraft | null;
}) {
	const { today, viewportWidth } = useTimelineController();
	const { items, dependencies, deleteDependency, undatedTaskRows } =
		useTimelineData();
	const { getPercentageOffset } = useHorizontalPercentageOffset();
	const { isSpanVisible } = useVirtualRows();

	const svgRef = useRef<SVGSVGElement>(null);

	const { rows } = useMemo(() => layoutItems(items, today), [items, today]);
	const rowByTask = useMemo(() => {
		const map = new Map<string, RowInfo>();
		for (const row of rows) {
			map.set(row.item.id, { rowIndex: row.rowIndex, range: row.range });
		}
		return map;
	}, [rows]);

	if (viewportWidth <= 0) return null;

	const totalRows = rows.length + undatedTaskRows.length;
	const pxX = (percent: number) => (percent / 100) * viewportWidth;

	return (
		<svg
			ref={svgRef}
			data-testid="dependency-layer"
			className="pointer-events-none absolute inset-0 z-10"
			width="100%"
			height={contentHeight(totalRows)}
		>
			<defs>
				<marker
					id="dep-arrow"
					viewBox="0 0 10 10"
					refX="8"
					refY="5"
					markerWidth="6"
					markerHeight="6"
					orient="auto-start-reverse"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
				</marker>
			</defs>

			{dependencies.map((dep) => {
				const from = rowByTask.get(dep.predecessorId);
				const to = rowByTask.get(dep.successorId);
				if (!from || !to) return null;
				if (!isSpanVisible(
					Math.min(from.rowIndex, to.rowIndex),
					Math.max(from.rowIndex, to.rowIndex),
				))
					return null;

				const fromAnchor: Anchor = dep.type[0] === "F" ? "finish" : "start";
				const toAnchor: Anchor = dep.type[1] === "F" ? "finish" : "start";
				const fromInfo = withDraft(from, draft, dep.predecessorId);
				const toInfo = withDraft(to, draft, dep.successorId);
				const p1 = { x: anchorXOf(fromInfo, fromAnchor, getPercentageOffset, pxX), y: rowCenterY(from.rowIndex) };
				const p2 = { x: anchorXOf(toInfo, toAnchor, getPercentageOffset, pxX), y: rowCenterY(to.rowIndex) };
				const midX = (p1.x + p2.x) / 2;

				return (
					<g key={dep.id} data-testid="dependency-link" className="group">
						<path
							d={elbowPath(p1, p2)}
							fill="none"
							strokeLinejoin="round"
							className="stroke-muted-foreground/70"
							strokeWidth={1.5}
							markerEnd="url(#dep-arrow)"
						/>
						{/* wide invisible hit area for hover/delete */}
						<path
							d={elbowPath(p1, p2)}
							fill="none"
							stroke="transparent"
							strokeWidth={10}
							className="pointer-events-auto cursor-pointer"
						/>
						<g
							className="pointer-events-auto cursor-pointer opacity-0 group-hover:opacity-100"
							onClick={() => deleteDependency(dep.id)}
						>
							<circle cx={midX} cy={(p1.y + p2.y) / 2} r={7} className="fill-background stroke-muted-foreground" />
							<path
								d={`M ${midX - 3} ${(p1.y + p2.y) / 2 - 3} L ${midX + 3} ${(p1.y + p2.y) / 2 + 3} M ${midX + 3} ${(p1.y + p2.y) / 2 - 3} L ${midX - 3} ${(p1.y + p2.y) / 2 + 3}`}
								className="stroke-muted-foreground"
								strokeWidth={1.5}
							/>
						</g>
					</g>
				);
			})}

			{linkDraft && (() => {
				const from = rowByTask.get(linkDraft.from.taskId);
				if (!from) return null;
				const fromInfo = withDraft(from, draft, linkDraft.from.taskId);
				const p1 = { x: anchorXOf(fromInfo, linkDraft.from.anchor, getPercentageOffset, pxX), y: rowCenterY(from.rowIndex) };
				// Convert pointer (client coords) into the svg's local coords.
				const rect = svgRef.current?.getBoundingClientRect();
				const p2 = {
					x: rect ? linkDraft.pointer.x - rect.left : p1.x,
					y: rect ? linkDraft.pointer.y - rect.top : p1.y,
				};
				return (
					<path
						data-testid="dependency-ghost"
						d={elbowPath(p1, p2)}
						fill="none"
						strokeLinejoin="round"
						strokeDasharray="4 3"
						className="stroke-primary"
						strokeWidth={1.5}
						markerEnd="url(#dep-arrow)"
					/>
				);
			})()}
		</svg>
	);
}

/** Apply a live drag draft range to a row's stored range, if present. */
function withDraft(
	info: RowInfo,
	draft: Record<string, RelativeTimeRangeOffset>,
	taskId: string,
): RowInfo {
	const d = draft[taskId];
	return d ? { ...info, range: d } : info;
}

function anchorXOf(
	info: RowInfo,
	anchor: Anchor,
	getPercentageOffset: (ms: number) => number,
	pxX: (percent: number) => number,
): number {
	const ms = anchor === "finish" ? info.range.to : info.range.from;
	return pxX(getPercentageOffset(ms));
}
