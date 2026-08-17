type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
	RESEND_API_KEY: string;
	RESEND_FROM_EMAIL?: string;
	TWILIO_ACCOUNT_SID?: string;
	TWILIO_AUTH_TOKEN?: string;
	TWILIO_FROM_NUMBER?: string;
	GITHUB_TOKEN?: string;
	GITHUB_REPO?: string;
	GITHUB_BRANCH?: string;
	CALENDAR_ICS_URL?: string;
	TEMPEST_TOKEN?: string;
	TEMPEST_STATION_ID?: string;
}

type ForumUser = {
	id: number;
	email: string;
	name: string | null;
	role: string;
	approved: number;
};

declare namespace App {
	interface Locals extends Runtime {
		user: ForumUser | null;
	}
}
