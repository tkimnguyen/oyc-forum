type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
	RESEND_API_KEY: string;
	RESEND_FROM_EMAIL?: string;
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
