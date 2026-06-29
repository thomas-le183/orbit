import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { rangeIds } from "./range";

export type RowSelectionValue = {
	selectedIds: ReadonlySet<string>;
	hoveredId: string | null;
	isSelected: (id: string) => boolean;
	selectOne: (id: string) => void;
	selectTo: (id: string, orderedIds: string[]) => void;
	toggle: (id: string) => void;
	selectAll: (orderedIds: string[]) => void;
	clear: () => void;
	setHovered: (id: string | null) => void;
};

const EMPTY: ReadonlySet<string> = new Set();

/** No-op default so consumers render without a provider (selection disabled). */
const NOOP: RowSelectionValue = {
	selectedIds: EMPTY,
	hoveredId: null,
	isSelected: () => false,
	selectOne: () => {},
	selectTo: () => {},
	toggle: () => {},
	selectAll: () => {},
	clear: () => {},
	setHovered: () => {},
};

const RowSelectionContext = createContext<RowSelectionValue>(NOOP);

export function RowSelectionProvider({ children }: { children: ReactNode }) {
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(EMPTY);
	const [anchorId, setAnchorId] = useState<string | null>(null);
	const [hoveredId, setHoveredId] = useState<string | null>(null);

	const selectOne = useCallback((id: string) => {
		setSelectedIds(new Set([id]));
		setAnchorId(id);
	}, []);

	const selectTo = useCallback(
		(id: string, orderedIds: string[]) => {
			setSelectedIds(new Set(rangeIds(orderedIds, anchorId, id)));
			// anchor stays put so further shift-clicks extend from the same origin
		},
		[anchorId],
	);

	const toggle = useCallback((id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
		setAnchorId(id);
	}, []);

	const selectAll = useCallback((orderedIds: string[]) => {
		setSelectedIds((prev) => {
			const allSelected =
				orderedIds.length > 0 && orderedIds.every((id) => prev.has(id));
			return allSelected ? new Set() : new Set(orderedIds);
		});
	}, []);

	const clear = useCallback(() => {
		setSelectedIds(EMPTY);
		setAnchorId(null);
	}, []);

	const setHovered = useCallback((id: string | null) => setHoveredId(id), []);

	const value = useMemo<RowSelectionValue>(
		() => ({
			selectedIds,
			hoveredId,
			isSelected: (id: string) => selectedIds.has(id),
			selectOne,
			selectTo,
			toggle,
			selectAll,
			clear,
			setHovered,
		}),
		[
			selectedIds,
			hoveredId,
			selectOne,
			selectTo,
			toggle,
			selectAll,
			clear,
			setHovered,
		],
	);

	return (
		<RowSelectionContext.Provider value={value}>
			{children}
		</RowSelectionContext.Provider>
	);
}

export function useRowSelection(): RowSelectionValue {
	return useContext(RowSelectionContext);
}
