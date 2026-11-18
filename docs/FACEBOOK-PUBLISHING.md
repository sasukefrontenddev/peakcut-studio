# Facebook Page Reels

Facebook is a separate publishing destination. Connecting Instagram does not authorize Facebook Page publishing.

Use a Meta developer app with the Pages use case and Facebook Login for Business. Request only `pages_show_list`, `pages_read_engagement` and `pages_manage_posts`. Register `https://peakcut-studio-chi.vercel.app/oauth/facebook/callback` and, if using a Business Login configuration, enter its configuration ID in PeakCut’s private app setup. Connect as the Facebook profile that can create content on the Page; share only the intended Pages in Meta’s authorization screen. Page tokens remain in the local engine and never enter the frontend or repository.

Select the connected Page in each creator’s Auto-post destinations. Existing score thresholds, spacing, daily caps and publishing pause still apply. Facebook Page Reels are public; private/unlisted creator settings are rejected rather than silently made public. Clips must be portrait 9:16, at least 540×960 and between 3 and 90 seconds. Uploads go directly to Meta, with no paid hosting required.

The queue keeps Meta’s video ID across retries and marks a Reel posted only after Meta reports it published. If processing is pending, the queue checks the same video again. A 30-Reel rolling 24-hour limit applies per Page across creators.

Meta controls permissions and app availability. App roles can test only the assets Meta permits; production use for other people may require review. Code support does not mean a Page is connected or that a live upload has been verified.

## TikTok inbox flow

After TikTok is selected as a creator destination, qualifying clips upload from PeakCut to TikTok. Open TikTok → Inbox → the upload notification, review/edit the video and tap Post. No downloading or manually uploading the file is required. PeakCut displays Finish in TikTok; inbox delivery is not counted as public publication. Public unattended posting requires TikTok’s app review.
