export type NotificationJobData =
	| {
			type: "member_joined";
			recipientId: string;
			actorName: string;
			orgName: string;
			orgSlug: string;
	  }
	| {
			type: "channel_added";
			recipientId: string;
			channelName: string;
			addedByName: string;
			orgSlug: string;
	  };
