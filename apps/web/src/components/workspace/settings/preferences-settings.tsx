import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@orbit/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@orbit/ui/components/select";
import { Skeleton } from "@orbit/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { useTheme } from "next-themes";
import type { UserPreferences } from "@/hooks/use-preferences";
import { usePreferences, useUpdatePreferences } from "@/hooks/use-preferences";
import { SettingsPage } from "./settings-page";

const THEMES = [
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
	{ value: "system", label: "System" },
];

const LANGUAGES = [
	{ value: "en", label: "English" },
	{ value: "fr", label: "Français" },
	{ value: "es", label: "Español" },
	{ value: "de", label: "Deutsch" },
	{ value: "ja", label: "日本語" },
];

const DATE_FORMATS = [
	{ value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
	{ value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
	{ value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const TIMEZONES = [
	{ value: "UTC", label: "UTC" },
	{ value: "America/New_York", label: "Eastern Time (ET)" },
	{ value: "America/Chicago", label: "Central Time (CT)" },
	{ value: "America/Denver", label: "Mountain Time (MT)" },
	{ value: "America/Los_Angeles", label: "Pacific Time (PT)" },
	{ value: "America/Toronto", label: "Toronto (ET)" },
	{ value: "America/Sao_Paulo", label: "Brasília Time (BRT)" },
	{ value: "Europe/London", label: "London (GMT/BST)" },
	{ value: "Europe/Paris", label: "Paris (CET/CEST)" },
	{ value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
	{ value: "Europe/Rome", label: "Rome (CET/CEST)" },
	{ value: "Europe/Moscow", label: "Moscow (MSK)" },
	{ value: "Africa/Cairo", label: "Cairo (EET)" },
	{ value: "Asia/Dubai", label: "Dubai (GST)" },
	{ value: "Asia/Kolkata", label: "India (IST)" },
	{ value: "Asia/Singapore", label: "Singapore (SGT)" },
	{ value: "Asia/Shanghai", label: "China (CST)" },
	{ value: "Asia/Tokyo", label: "Tokyo (JST)" },
	{ value: "Asia/Seoul", label: "Seoul (KST)" },
	{ value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
	{ value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
	{ value: "Pacific/Honolulu", label: "Hawaii (HST)" },
];

const WEEK_START_DAYS = [
	{ value: "0", label: "Sunday" },
	{ value: "1", label: "Monday" },
];

export function PreferencesSettings() {
	const { data: prefs } = usePreferences();

	return (
		<SettingsPage
			title="Preferences"
			subtitle="Customize your personal experience."
		>
			{prefs ? (
				<PreferencesForm prefs={prefs} />
			) : (
				<FieldGroup>
					{Array.from({ length: 5 }).map((_, i) => (
						<Field key={i} orientation="horizontal">
							<FieldContent>
								<Skeleton className="h-4 w-24" />
								<Skeleton className="mt-1 h-3 w-48" />
							</FieldContent>
							<Skeleton className="h-9 w-70 shrink-0" />
						</Field>
					))}
				</FieldGroup>
			)}
		</SettingsPage>
	);
}

function PreferencesForm({ prefs }: { prefs: UserPreferences }) {
	const updatePreferences = useUpdatePreferences();
	const { setTheme } = useTheme();

	const form = useForm({
		defaultValues: {
			theme: prefs.theme as "light" | "dark" | "system",
			language: prefs.language,
			dateFormat: prefs.dateFormat,
			timezone:
				prefs.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
			weekStart: String(prefs.weekStart),
		},
		onSubmit: () => {},
	});

	return (
		<FieldGroup>
			<form.Field name="theme">
				{(field) => (
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel>Theme</FieldLabel>
							<FieldDescription>
								Controls the color scheme of the interface
							</FieldDescription>
						</FieldContent>
						<Select
							items={THEMES}
							value={field.state.value}
							onValueChange={(value) => {
								if (!value) return;
								const v = value as "light" | "dark" | "system";
								field.handleChange(v);
								setTheme(v);
								updatePreferences.mutate({ theme: v });
							}}
						>
							<SelectTrigger className="w-70 shrink-0">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{THEMES.map(({ value, label }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="language">
				{(field) => (
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel>Language</FieldLabel>
							<FieldDescription>
								Display language for the interface
							</FieldDescription>
						</FieldContent>
						<Select
							items={LANGUAGES}
							value={field.state.value}
							onValueChange={(value) => {
								if (!value) return;
								field.handleChange(value);
								updatePreferences.mutate({ language: value });
							}}
						>
							<SelectTrigger className="w-70 shrink-0">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{LANGUAGES.map(({ value, label }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="dateFormat">
				{(field) => (
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel>Date format</FieldLabel>
							<FieldDescription>
								How dates appear throughout the app
							</FieldDescription>
						</FieldContent>
						<Select
							items={DATE_FORMATS}
							value={field.state.value}
							onValueChange={(value) => {
								if (!value) return;
								field.handleChange(value);
								updatePreferences.mutate({ dateFormat: value });
							}}
						>
							<SelectTrigger className="w-70 shrink-0">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DATE_FORMATS.map(({ value, label }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="timezone">
				{(field) => (
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel>Timezone</FieldLabel>
							<FieldDescription>
								Used for scheduling and date display
							</FieldDescription>
						</FieldContent>
						<Select
							items={TIMEZONES}
							value={field.state.value}
							onValueChange={(value) => {
								if (!value) return;
								field.handleChange(value);
								updatePreferences.mutate({ timezone: value });
							}}
						>
							<SelectTrigger className="w-70 shrink-0">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TIMEZONES.map(({ value, label }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>

			<form.Field name="weekStart">
				{(field) => (
					<Field orientation="horizontal">
						<FieldContent>
							<FieldLabel>Week starts on</FieldLabel>
							<FieldDescription>
								First day shown in calendar views
							</FieldDescription>
						</FieldContent>
						<Select
							items={WEEK_START_DAYS}
							value={field.state.value}
							onValueChange={(value) => {
								if (!value) return;
								field.handleChange(value);
								updatePreferences.mutate({
									weekStart: Number(value) as 0 | 1,
								});
							}}
						>
							<SelectTrigger className="w-70 shrink-0">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{WEEK_START_DAYS.map(({ value, label }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				)}
			</form.Field>
		</FieldGroup>
	);
}
