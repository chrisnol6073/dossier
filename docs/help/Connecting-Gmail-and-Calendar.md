This is optional. With a Google account connected, Jobs Ireland sends an application from your own Gmail address with its PDFs attached, checks Gmail every few minutes for employers' replies and links them to their applications, has the AI read each reply and draft your answer, offers times you're free in Google Calendar, and adds agreed interviews to it. Nothing is sent, and no status changes, until you confirm it.

The dashboard's **Calendar** shows a month, with marks on the days that have something on, and the week ahead from the day you pick: the events in your Google Calendar, with your interviews linked to their applications. It sits beside the other cards when the window is wide enough, and under them when it isn't. Interviews stay in step both ways: change or remove an interview's date in Jobs Ireland and its event moves or goes; move or delete the event in Google Calendar and Jobs Ireland follows.

## Set up your own Google client

Google doesn't let one sign-in serve every server, so each install brings its own OAuth client. The setup guide in Jobs Ireland walks through these steps with the links and the address to copy; this is the same list.

1. Sign in to [Google Cloud](https://console.cloud.google.com/projectcreate) and create a project, named Jobs Ireland for example.
2. Enable the [Gmail API](https://console.cloud.google.com/apis/enableflow;apiid=gmail.googleapis.com) and the [Google Calendar API](https://console.cloud.google.com/apis/enableflow;apiid=calendar-json.googleapis.com) in it.
3. In Google Auth Platform's [Branding](https://console.developers.google.com/auth/branding), press **Get started**: an app name, your email, **External** as the audience, your email again, agree to the policy, **Create**.
4. In [Audience](https://console.developers.google.com/auth/audience), press **Publish app**. While it's in Testing, Google stops the access after 7 days.
5. In [Clients](https://console.developers.google.com/auth/clients), press **Create client**: type **Web application**, and under **Authorized redirect URIs** add `https://<your Jobs Ireland address>/api/google/callback`. Settings → Google shows the exact address to copy. Leave **Use this client for an AI-powered agent** unticked.
6. Copy the client ID and secret into **Settings → Google**, or set `DOSSIER_GOOGLE_CLIENT_ID` and `DOSSIER_GOOGLE_CLIENT_SECRET` (see [Environment variables](Environment-variables.md)). Google shows the secret only once; if it's lost, add a new one on the client's page. Then press **Connect Google account** and choose what Jobs Ireland may do: send, read, and use your calendar.

**Which addresses Google takes:** an address starting with `https://`, with a name rather than numbers, such as `https://jobs.example.com/api/google/callback`, or `http://localhost:3000/...` and `http://127.0.0.1:...` on the computer Jobs Ireland runs on. Google refuses plain `http://` on any other address, and IP addresses such as `192.168.1.20`. A new address can take from a few minutes to a few hours to work: until then Google says `redirect_uri_mismatch`.

Google only verifies apps that read mail after a security review, so its sign-in page warns that the app isn't verified. It's your own client: press **Advanced**, then **Go to … (unsafe)**. An unverified client can be used by up to 100 Google accounts over its whole life, which is plenty for your own. The refresh token is stored encrypted with `DOSSIER_SECRET`. **Disconnect** revokes Jobs Ireland's access at Google.

**It stops working when:** you change your Google password (connect again), Jobs Ireland hasn't used the connection for six months, or the client hasn't been used for six months, when Google deletes it after an email warning.

## What it reads

By default the inbox check only keeps mail in threads Jobs Ireland sent and mail from the companies you applied to. **Every new email** in Settings → Google keeps all new mail outside Promotions and Social, and the AI reads that too. [PRIVACY.md](https://github.com/chrisnol6073/dossier/blob/main/PRIVACY.md#what-dossier-keeps) says what's kept, for how long, and what goes to Google and the AI.


---

_Adapted from the [Dossier wiki](https://github.com/AienTech/dossier/wiki), the AGPL-3.0 project Jobs Ireland is based on._
