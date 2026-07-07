import {
	createContext,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import { useCreateTask } from "@/hooks/use-tasks";

type DraftTaskValue = {
	enabled: boolean;
	name: string;
	startDate?: string;
	endDate?: string;
	dragging: boolean;
	isPending: boolean;
	inputRef: RefObject<HTMLInputElement | null>;
	setName: (v: string) => void;
	setDates: (startDate: string, endDate: string) => void;
	setDragging: (v: boolean) => void;
	focusInput: () => void;
	commit: () => void;
	cancel: () => void;
};

const noop = () => {};

/** Disabled fallback so panes rendered outside the provider render no draft row. */
const DISABLED: DraftTaskValue = {
	enabled: false,
	name: "",
	startDate: undefined,
	endDate: undefined,
	dragging: false,
	isPending: false,
	inputRef: { current: null },
	setName: noop,
	setDates: noop,
	setDragging: noop,
	focusInput: noop,
	commit: noop,
	cancel: noop,
};

const Ctx = createContext<DraftTaskValue>(DISABLED);

export function useDraftTask(): DraftTaskValue {
	return useContext(Ctx);
}

export function DraftTaskProvider({
	projectId,
	enabled,
	children,
}: {
	projectId: string;
	enabled: boolean;
	children: ReactNode;
}) {
	const create = useCreateTask(projectId);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [name, setName] = useState("");
	const [range, setRange] = useState<{ startDate?: string; endDate?: string }>(
		{},
	);
	const [dragging, setDragging] = useState(false);

	const setDates = useCallback((startDate: string, endDate: string) => {
		setRange({ startDate, endDate });
	}, []);

	const reset = useCallback(() => {
		setName("");
		setRange({});
		setDragging(false);
	}, []);

	const cancel = useCallback(() => reset(), [reset]);
	const focusInput = useCallback(() => inputRef.current?.focus(), []);

	const commit = useCallback(() => {
		const trimmed = name.trim();
		if (!trimmed || create.isPending) return;
		create.mutate(
			{
				name: trimmed,
				...(range.startDate ? { startDate: range.startDate } : {}),
				...(range.endDate ? { endDate: range.endDate } : {}),
			},
			{
				onSuccess: () => {
					reset();
					inputRef.current?.focus();
				},
			},
		);
	}, [name, range, create, reset]);

	const value = useMemo<DraftTaskValue>(
		() => ({
			enabled,
			name,
			startDate: range.startDate,
			endDate: range.endDate,
			dragging,
			isPending: create.isPending,
			inputRef,
			setName,
			setDates,
			setDragging,
			focusInput,
			commit,
			cancel,
		}),
		[
			enabled,
			name,
			range.startDate,
			range.endDate,
			dragging,
			create.isPending,
			setDates,
			focusInput,
			commit,
			cancel,
		],
	);

	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
