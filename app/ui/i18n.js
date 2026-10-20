// UI strings and the in-app guide, German and English.
const STRINGS = {
  de: {
    'step.login': 'Anmelden',
    'step.export': 'Export',
    'step.select': 'Auswahl',
    'step.import': 'Import',
    'guide.button': 'Anleitung',
    'guide.title': 'Anleitung',
    'common.cancel': 'Abbrechen',
    'common.next': 'Weiter',

    'welcome.title': 'Von Instagram zu Pixelfed 👋',
    'welcome.text': 'Diese App überträgt deine Instagram-Beiträge mit Bildern, Videos und Bildunterschriften zu deinem Pixelfed-Account. Du brauchst dafür deinen Instagram-Datenexport (ZIP-Datei) und einen Pixelfed-Account.',
    'welcome.guide': 'Noch keinen Export? So lädst du ihn bei Instagram herunter →',

    'login.title': 'Bei Pixelfed anmelden',
    'login.text': 'Gib die Adresse deiner Pixelfed-Instanz ein. Danach öffnet sich dein Browser, dort meldest du dich an und erlaubst den Zugriff.',
    'login.instance': 'Pixelfed-Instanz',
    'login.oauth': 'Im Browser anmelden',
    'login.waiting': 'Warte auf die Anmeldung im Browser …',
    'login.token.summary': 'Klappt nicht? Stattdessen mit Zugriffstoken anmelden',
    'login.token.s1': 'Öffne in Pixelfed <b>Einstellungen → Anwendungen</b> (Button unten).',
    'login.token.s2': 'Unter <b>Personal Access Tokens</b> auf <b>Create New Token</b> klicken, beliebigen Namen eingeben und die Berechtigungen <b>read</b> und <b>write</b> anhaken.',
    'login.token.s3': 'Den angezeigten Token kopieren und hier einfügen.',
    'login.token.open': 'Token-Seite öffnen',
    'login.token.label': 'Zugriffstoken',
    'login.token.submit': 'Mit Token anmelden',
    'login.signedin': 'Angemeldet als',
    'login.logout': 'Abmelden',
    'login.limits': 'Limits dieser Instanz: {chars} Zeichen, {media} Bilder pro Beitrag',

    'export.title': 'Instagram-Export öffnen',
    'export.text': 'Wähle die <b>ZIP-Datei</b> deines Instagram-Exports aus, du musst sie nicht entpacken. Wenn Instagram den Export in mehrere Teile aufgeteilt hat, wähle <b>alle Teile gleichzeitig</b> aus. Ein bereits entpackter Ordner funktioniert auch.',
    'export.drop': 'ZIP-Datei(en) oder Ordner hierher ziehen',
    'export.zip': 'ZIP-Datei(en) wählen',
    'export.folder': 'Ordner wählen',
    'export.loading': 'Export wird gelesen …',
    'export.recent': 'Zuletzt geöffnet:',
    'export.noexport': 'Wie bekomme ich meinen Instagram-Export? →',

    'select.search': 'In Bildunterschriften suchen',
    'select.hideImported': 'Importierte ausblenden',
    'select.all': 'Alle auswählen',
    'select.none': 'Keine',
    'select.invert': 'Umkehren',
    'select.allYears': 'Alle Jahre',
    'select.visible': '{n} Beiträge angezeigt',
    'select.imported': 'Importiert',
    'select.partial': 'Teilweise',
    'select.missing': 'Dateien fehlen',
    'select.missingHint': 'Einige Dateien dieses Beitrags fehlen im Export. Hast du alle ZIP-Teile ausgewählt?',
    'select.forget': 'Erneut importieren',
    'select.forgetSure': 'Sicher? Klick nochmal',
    'select.noCaption': 'Ohne Bildunterschrift',
    'src.posts': 'Beiträge',
    'src.archived': 'Archiviert',
    'src.reels': 'Reels',
    'src.igtv': 'IGTV',

    'opts.title': 'Optionen',
    'opts.visibility': 'Sichtbarkeit',
    'opts.vis.public': 'Öffentlich',
    'opts.vis.unlisted': 'Nicht gelistet (empfohlen)',
    'opts.vis.private': 'Nur Follower',
    'opts.vis.hint.public': 'Erscheint in öffentlichen Timelines und bei allen Followern. Bei vielen Beiträgen flutest du so deren Timeline.',
    'opts.vis.hint.unlisted': 'Auf deinem Profil sichtbar, landet aber nicht in den öffentlichen Timelines.',
    'opts.vis.hint.private': 'Nur deine Follower sehen die Beiträge.',
    'opts.footer': 'Originaldatum unter die Bildunterschrift setzen',
    'opts.footerDefault': '📷 Ursprünglich auf Instagram gepostet am {date}',
    'opts.sensitive': 'Alle als sensibel markieren (Inhaltswarnung)',
    'opts.delay': 'Pause zwischen Beiträgen',
    'opts.delayHint': 'Längere Pausen schonen die Instanz und vermeiden Rate-Limits.',
    'opts.help': 'Was bedeuten die Optionen?',
    'opts.summary': '<b>{n}</b> ausgewählt · {files} Dateien<br>ergibt <b>{posts}</b> Pixelfed-Beiträge<br>Dauer ca. <b>{eta}</b>',
    'opts.split': 'Aufgeteilte Alben: {n} (max. {max} Bilder pro Beitrag)',
    'opts.cut': 'Gekürzte Bildunterschriften: {n} (max. {max} Zeichen)',
    'opts.videos': 'Beiträge mit Videos, die diese Instanz nicht annimmt: {n}',
    'opts.start': '{n} Beiträge importieren',
    'opts.startNone': 'Nichts ausgewählt',

    'import.running': 'Import läuft …',
    'import.paused': 'Pausiert',
    'import.done': 'Fertig! 🎉',
    'import.stopped': 'Import gestoppt',
    'import.pause': '⏸ Pausieren',
    'import.resume': '▶ Fortsetzen',
    'import.stop': 'Stoppen',
    'import.ok': 'importiert',
    'import.failed': 'fehlgeschlagen',
    'import.left': 'verbleibend',
    'import.eta': 'Restzeit',
    'import.log': 'Verlauf',
    'import.profile': 'Profil auf Pixelfed öffnen',
    'import.retry': 'Fehlgeschlagene erneut versuchen',
    'import.back': 'Zurück zur Auswahl',
    'import.step.upload': 'Lade Datei {a} von {b} hoch …',
    'import.step.post': 'Erstelle Beitrag …',
    'import.step.wait': 'Server bremst ({err}), warte {s} s …',
    'import.step.paused': 'Pausiert, klicke auf „Fortsetzen“',
    'import.step.next': 'Fertig, kurze Pause bis zum nächsten Beitrag …',
    'import.view': 'Ansehen',
    'import.skipped': 'übersprungen: {files}',
    'import.stopHint': 'Bereits importierte Beiträge bleiben gespeichert. Du kannst jederzeit weitermachen.',
    'import.leave': 'Der Import läuft noch. Pausiere oder stoppe ihn zuerst.',

    'preview.caption': 'So sieht die Bildunterschrift auf Pixelfed aus',
    'preview.parts': 'wird auf {n} Beiträge aufgeteilt',

    'err.html_format': 'Dieser Export ist im HTML-Format. Die App braucht das Format JSON. Fordere den Export bei Instagram bitte erneut an und wähle dabei „JSON“ als Format.',
    'err.no_posts': 'In dieser Auswahl wurden keine Beiträge gefunden. Ist das ein Instagram-Export? Bei mehrteiligen Exporten bitte alle Teile auswählen.',
    'err.auth': 'Die Anmeldung ist ungültig oder abgelaufen. Bitte melde dich neu an.',
    'err.running': 'Es läuft gerade ein Import.',
    'err.cancelled': 'Anmeldung abgebrochen.',
    'err.timeout': 'Die Anmeldung hat zu lange gedauert. Bitte versuche es noch einmal.',
    'err.instance': 'Bitte gib eine Instanz ein, z. B. pixelfed.social.',
    'err.connect': 'Die Instanz ist nicht erreichbar. Stimmt die Adresse? ({msg})',
    'err.register_app': 'Die Instanz erlaubt keine Anmeldung per Browser ({msg}). Nutze stattdessen einen Zugriffstoken (siehe unten).',
    'err.generic': 'Fehler: {msg}',
    'err.fatal': 'Import abgebrochen: Die Anmeldung ist ungültig geworden. Bitte neu anmelden und fortsetzen.',
  },
  en: {
    'step.login': 'Sign in',
    'step.export': 'Export',
    'step.select': 'Select',
    'step.import': 'Import',
    'guide.button': 'Guide',
    'guide.title': 'Guide',
    'common.cancel': 'Cancel',
    'common.next': 'Continue',

    'welcome.title': 'From Instagram to Pixelfed 👋',
    'welcome.text': 'This app moves your Instagram posts (photos, videos and captions) to your Pixelfed account. You need your Instagram data export (a ZIP file) and a Pixelfed account.',
    'welcome.guide': 'No export yet? Here’s how to download it from Instagram →',

    'login.title': 'Sign in to Pixelfed',
    'login.text': 'Enter the address of your Pixelfed instance. Your browser will open so you can sign in and allow access.',
    'login.instance': 'Pixelfed instance',
    'login.oauth': 'Sign in with browser',
    'login.waiting': 'Waiting for you to sign in in the browser …',
    'login.token.summary': 'Not working? Sign in with an access token instead',
    'login.token.s1': 'In Pixelfed, open <b>Settings → Applications</b> (button below).',
    'login.token.s2': 'Under <b>Personal Access Tokens</b>, click <b>Create New Token</b>, enter any name and tick the <b>read</b> and <b>write</b> scopes.',
    'login.token.s3': 'Copy the token and paste it here.',
    'login.token.open': 'Open token page',
    'login.token.label': 'Access token',
    'login.token.submit': 'Sign in with token',
    'login.signedin': 'Signed in as',
    'login.logout': 'Sign out',
    'login.limits': 'Instance limits: {chars} characters, {media} photos per post',

    'export.title': 'Open your Instagram export',
    'export.text': 'Choose the <b>ZIP file</b> of your Instagram export. You don’t need to unpack it. If Instagram split the export into several parts, select <b>all parts at once</b>. An already unpacked folder works too.',
    'export.drop': 'Drop ZIP file(s) or a folder here',
    'export.zip': 'Choose ZIP file(s)',
    'export.folder': 'Choose folder',
    'export.loading': 'Reading export …',
    'export.recent': 'Recently opened:',
    'export.noexport': 'How do I get my Instagram export? →',

    'select.search': 'Search captions',
    'select.hideImported': 'Hide imported',
    'select.all': 'Select all',
    'select.none': 'None',
    'select.invert': 'Invert',
    'select.allYears': 'All years',
    'select.visible': '{n} posts shown',
    'select.imported': 'Imported',
    'select.partial': 'Partial',
    'select.missing': 'Files missing',
    'select.missingHint': 'Some files of this post are missing from the export. Did you select all ZIP parts?',
    'select.forget': 'Import again',
    'select.forgetSure': 'Sure? Click again',
    'select.noCaption': 'No caption',
    'src.posts': 'Posts',
    'src.archived': 'Archived',
    'src.reels': 'Reels',
    'src.igtv': 'IGTV',

    'opts.title': 'Options',
    'opts.visibility': 'Visibility',
    'opts.vis.public': 'Public',
    'opts.vis.unlisted': 'Unlisted (recommended)',
    'opts.vis.private': 'Followers only',
    'opts.vis.hint.public': 'Shows up in public timelines and for all followers. With many posts you’ll flood their timeline.',
    'opts.vis.hint.unlisted': 'Visible on your profile, but kept out of public timelines.',
    'opts.vis.hint.private': 'Only your followers can see the posts.',
    'opts.footer': 'Add the original date below the caption',
    'opts.footerDefault': '📷 Originally posted on Instagram on {date}',
    'opts.sensitive': 'Mark all as sensitive (content warning)',
    'opts.delay': 'Pause between posts',
    'opts.delayHint': 'Longer pauses are kinder to the instance and avoid rate limits.',
    'opts.help': 'What do these options mean?',
    'opts.summary': '<b>{n}</b> selected · {files} files<br>becomes <b>{posts}</b> Pixelfed posts<br>takes about <b>{eta}</b>',
    'opts.split': 'Albums split into several posts: {n} (max. {max} photos each)',
    'opts.cut': 'Shortened captions: {n} (max. {max} characters)',
    'opts.videos': 'Posts with videos this instance doesn’t accept: {n}',
    'opts.start': 'Import {n} posts',
    'opts.startNone': 'Nothing selected',

    'import.running': 'Importing …',
    'import.paused': 'Paused',
    'import.done': 'Done! 🎉',
    'import.stopped': 'Import stopped',
    'import.pause': '⏸ Pause',
    'import.resume': '▶ Resume',
    'import.stop': 'Stop',
    'import.ok': 'imported',
    'import.failed': 'failed',
    'import.left': 'remaining',
    'import.eta': 'time left',
    'import.log': 'Log',
    'import.profile': 'Open profile on Pixelfed',
    'import.retry': 'Retry failed posts',
    'import.back': 'Back to selection',
    'import.step.upload': 'Uploading file {a} of {b} …',
    'import.step.post': 'Creating post …',
    'import.step.wait': 'Server is throttling ({err}), waiting {s} s …',
    'import.step.paused': 'Paused, click “Resume”',
    'import.step.next': 'Done, short pause before the next post …',
    'import.view': 'View',
    'import.skipped': 'skipped: {files}',
    'import.stopHint': 'Posts imported so far are remembered. You can continue any time.',
    'import.leave': 'The import is still running. Pause or stop it first.',

    'preview.caption': 'This is how the caption will look on Pixelfed',
    'preview.parts': 'will be split into {n} posts',

    'err.html_format': 'This export is in HTML format, but the app needs JSON. Please request the export from Instagram again and choose “JSON” as the format.',
    'err.no_posts': 'No posts found in this selection. Is this an Instagram export? For multi-part exports, select all parts.',
    'err.auth': 'Your sign-in is invalid or has expired. Please sign in again.',
    'err.running': 'An import is currently running.',
    'err.cancelled': 'Sign-in cancelled.',
    'err.timeout': 'Sign-in took too long. Please try again.',
    'err.instance': 'Please enter an instance, e.g. pixelfed.social.',
    'err.connect': 'Can’t reach the instance. Is the address correct? ({msg})',
    'err.register_app': 'This instance doesn’t allow browser sign-in ({msg}). Use an access token instead (see below).',
    'err.generic': 'Error: {msg}',
    'err.fatal': 'Import stopped: your sign-in became invalid. Please sign in again and continue.',
  },
};

// The guide: sections with an id (used for deep links), a title and HTML.
// Buttons with data-open="<url>" open in the system browser; "{instance}" is replaced.
const GUIDE = {
  de: [
    {
      id: 'instagram', title: '1. Instagram-Export anfordern',
      html: `
<p>Instagram stellt dir alle deine Beiträge als Datei-Paket zur Verfügung. So forderst du es an:</p>
<ol class="steps-list">
  <li>Öffne die <b>Kontenübersicht</b> von Meta. In der Instagram-App: Profil → Menü <b>☰</b> → <b>Kontenübersicht</b>. Oder direkt im Browser:
    <br><button class="secondary small" data-open="https://accountscenter.instagram.com/info_and_permissions/dyi/">Kontenübersicht öffnen ↗</button></li>
  <li>Gehe zu <b>Deine Informationen und Berechtigungen</b> → <b>Deine Informationen herunterladen</b> → <b>Informationen herunterladen</b>.</li>
  <li>Wähle deinen <b>Instagram-Account</b> aus und dann <b>Einige deiner Informationen</b>.</li>
  <li>Hake unter „Deine Instagram-Aktivität“ <b>Medien</b> bzw. <b>Inhalte</b> an (das sind deine Beiträge, Reels und Stories). Alles andere brauchst du nicht.</li>
  <li>Wähle <b>Auf Gerät herunterladen</b> und stelle ein:
    <ul>
      <li>Zeitraum: <b>Gesamter Zeitraum</b></li>
      <li>Format: <b>JSON</b> ⚠️ <i>wichtig, HTML funktioniert nicht</i></li>
      <li>Medienqualität: <b>Hoch</b></li>
    </ul></li>
  <li>Klicke auf <b>Dateien erstellen</b>. Instagram schickt dir eine E-Mail, sobald der Export fertig ist. Das dauert ein paar Minuten bis zu zwei Tagen.</li>
  <li>Lade die Datei dann unter <b>Informationen herunterladen</b> herunter. Bei großen Accounts gibt es <b>mehrere ZIP-Teile</b>, lade alle herunter.</li>
</ol>
<p class="note">💡 Die ZIP-Datei musst du nicht entpacken, die App liest sie direkt.</p>`,
    },
    {
      id: 'login', title: '2. Bei Pixelfed anmelden',
      html: `
<ol class="steps-list">
  <li>Gib die Adresse deiner Instanz ein, z. B. <code>pixelfed.social</code>. Das ist der Teil nach dem zweiten @ in deinem Benutzernamen (<code>@du@<b>pixelfed.social</b></code>).</li>
  <li>Klicke auf <b>Im Browser anmelden</b>. Dein Browser öffnet sich mit der Pixelfed-Seite.</li>
  <li>Melde dich dort an (falls nötig) und klicke auf <b>Authorize</b> bzw. <b>Erlauben</b>.</li>
  <li>Der Browser zeigt „Angemeldet“. Du kannst den Tab schließen, die App macht automatisch weiter.</li>
</ol>
<p><b>Alternative: Zugriffstoken.</b> Falls die Anmeldung per Browser nicht klappt: In Pixelfed unter <b>Einstellungen → Anwendungen → Personal Access Tokens</b> einen Token mit den Rechten <b>read</b> und <b>write</b> erstellen und in der App einfügen.</p>
<button class="secondary small" data-open="{instance}/settings/applications">Token-Seite öffnen ↗</button>
<p class="note">🔒 Die App speichert die Anmeldung nur auf diesem Computer. „Abmelden“ löscht sie wieder. Den Zugriff kannst du jederzeit in Pixelfed unter Einstellungen → Anwendungen widerrufen.</p>`,
    },
    {
      id: 'export', title: '3. Export öffnen',
      html: `
<ul>
  <li><b>ZIP-Datei(en) wählen:</b> Wähle die heruntergeladene ZIP-Datei. Bei mehrteiligen Exporten markierst du alle Teile gleichzeitig (Cmd/Strg + Klick).</li>
  <li><b>Ordner wählen:</b> Falls du den Export schon entpackt hast.</li>
  <li><b>Drag & Drop:</b> Zieh die Datei(en) einfach ins Fenster.</li>
</ul>
<p>Die App findet Beiträge, archivierte Beiträge, Reels und IGTV-Videos. Stories, Kommentare, Likes und Follower werden nicht übertragen.</p>`,
    },
    {
      id: 'import', title: '4. Auswählen & importieren',
      html: `
<p>Du siehst alle gefundenen Beiträge. Anfangs sind alle ausgewählt, die noch nicht importiert sind.</p>
<ul>
  <li><b>Haken</b> oben rechts an jedem Bild: Beitrag aus- oder abwählen. <b>Klick aufs Bild</b> zeigt eine Vorschau mit der fertigen Bildunterschrift.</li>
  <li>Oben kannst du nach Art (Beiträge, Reels …), Jahr oder Text filtern. „Alle auswählen“ bezieht sich auf die gerade angezeigten Beiträge.</li>
</ul>
<h4>Optionen</h4>
<ul>
  <li><b>Sichtbarkeit:</b> <i>Nicht gelistet</i> (empfohlen) zeigt die Beiträge auf deinem Profil, ohne die öffentlichen Timelines zu fluten. <i>Öffentlich</i> postet ganz normal. <i>Nur Follower</i> ist privat.</li>
  <li><b>Originaldatum:</b> Pixelfed setzt bei jedem Beitrag das heutige Datum, das Originaldatum lässt sich nicht übernehmen. Deshalb kann die App es unter die Bildunterschrift schreiben. Den Text kannst du anpassen, <code>{date}</code> wird durch das Datum ersetzt.</li>
  <li><b>Sensibel:</b> Versieht alle Beiträge mit einer Inhaltswarnung.</li>
  <li><b>Pause:</b> Wartezeit zwischen zwei Beiträgen. Viele Instanzen begrenzen, wie schnell man posten darf.</li>
</ul>
<h4>Während des Imports</h4>
<ul>
  <li>Beiträge werden <b>vom ältesten zum neuesten</b> hochgeladen, damit dein Profil die richtige Reihenfolge hat.</li>
  <li>Mit <b>Pausieren</b> hältst du an, mit <b>Fortsetzen</b> geht’s weiter.</li>
  <li>Du kannst den Import auch <b>stoppen oder die App schließen</b>. Die App merkt sich, was schon importiert ist. Beim nächsten Mal öffnest du einfach denselben Export wieder („Zuletzt geöffnet“), und nur die restlichen Beiträge sind ausgewählt.</li>
  <li>Bremst der Server (Rate-Limit), wartet die App automatisch und versucht es erneut.</li>
</ul>`,
    },
    {
      id: 'faq', title: 'Gut zu wissen',
      html: `
<dl class="faq">
  <dt>Warum stimmt das Datum nicht?</dt>
  <dd>Pixelfed erlaubt über die Schnittstelle kein Rückdatieren. Die Beiträge erscheinen mit dem Import-Datum, das Originaldatum steht in der Bildunterschrift.</dd>
  <dt>Mein Album wurde aufgeteilt</dt>
  <dd>Jede Instanz legt fest, wie viele Bilder ein Beitrag haben darf. Größere Alben werden auf mehrere Beiträge mit „(1/2)“, „(2/2)“ verteilt.</dd>
  <dt>Die Bildunterschrift wurde gekürzt</dt>
  <dd>Auch die maximale Textlänge legt die Instanz fest. Zu lange Texte enden mit „…“.</dd>
  <dt>Ein Video wurde übersprungen</dt>
  <dd>Manche Instanzen nehmen keine Videos an oder haben eine Größengrenze. Das steht dann im Verlauf.</dd>
  <dt>Kann ich einen Beitrag nochmal importieren?</dt>
  <dd>Ja: Fahre in der Auswahl über einen importierten Beitrag und klicke auf „Erneut importieren“. Lösche den alten Beitrag vorher in Pixelfed, sonst hast du ihn doppelt.</dd>
  <dt>Mehrere Instagram-Accounts?</dt>
  <dd>Melde dich für jeden mit dem passenden Pixelfed-Account an und öffne den jeweiligen Export. Die App merkt sich den Fortschritt pro Pixelfed-Account.</dd>
  <dt>Wo landen meine Daten?</dt>
  <dd>Nur auf diesem Computer und auf deiner Pixelfed-Instanz. Es gibt keinen Server dazwischen.</dd>
  <dt>Was ist mit @Erwähnungen und #Hashtags?</dt>
  <dd>Hashtags funktionieren auf Pixelfed genauso. @Erwähnungen verweisen auf Pixelfed-Nutzer gleichen Namens, nicht auf Instagram.</dd>
</dl>`,
    },
  ],
  en: [
    {
      id: 'instagram', title: '1. Request your Instagram export',
      html: `
<p>Instagram can give you all your posts as a downloadable package. Here’s how to request it:</p>
<ol class="steps-list">
  <li>Open Meta’s <b>Accounts Center</b>. In the Instagram app: Profile → menu <b>☰</b> → <b>Accounts Center</b>. Or directly in your browser:
    <br><button class="secondary small" data-open="https://accountscenter.instagram.com/info_and_permissions/dyi/">Open Accounts Center ↗</button></li>
  <li>Go to <b>Your information and permissions</b> → <b>Download your information</b> → <b>Download or transfer information</b>.</li>
  <li>Pick your <b>Instagram account</b>, then <b>Some of your information</b>.</li>
  <li>Under “Your Instagram activity”, tick <b>Media</b> or <b>Content</b> (your posts, reels and stories). You don’t need anything else.</li>
  <li>Choose <b>Download to device</b> and set:
    <ul>
      <li>Date range: <b>All time</b></li>
      <li>Format: <b>JSON</b> ⚠️ <i>important, HTML won’t work</i></li>
      <li>Media quality: <b>High</b></li>
    </ul></li>
  <li>Click <b>Create files</b>. Instagram emails you when the export is ready. This takes a few minutes up to two days.</li>
  <li>Then download it under <b>Download your information</b>. Large accounts get <b>several ZIP parts</b>, so download all of them.</li>
</ol>
<p class="note">💡 You don’t need to unzip the file. The app reads it directly.</p>`,
    },
    {
      id: 'login', title: '2. Sign in to Pixelfed',
      html: `
<ol class="steps-list">
  <li>Enter your instance address, e.g. <code>pixelfed.social</code>. It’s the part after the second @ in your handle (<code>@you@<b>pixelfed.social</b></code>).</li>
  <li>Click <b>Sign in with browser</b>. Your browser opens the Pixelfed page.</li>
  <li>Sign in there (if needed) and click <b>Authorize</b>.</li>
  <li>The browser says “Signed in”. You can close the tab, the app continues automatically.</li>
</ol>
<p><b>Alternative: access token.</b> If browser sign-in doesn’t work: In Pixelfed go to <b>Settings → Applications → Personal Access Tokens</b>, create a token with the <b>read</b> and <b>write</b> scopes and paste it into the app.</p>
<button class="secondary small" data-open="{instance}/settings/applications">Open token page ↗</button>
<p class="note">🔒 The app stores your sign-in only on this computer. “Sign out” removes it. You can revoke access any time in Pixelfed under Settings → Applications.</p>`,
    },
    {
      id: 'export', title: '3. Open the export',
      html: `
<ul>
  <li><b>Choose ZIP file(s):</b> Pick the downloaded ZIP. For multi-part exports select all parts at once (Cmd/Ctrl + click).</li>
  <li><b>Choose folder:</b> If you already unpacked the export.</li>
  <li><b>Drag & drop:</b> Just drop the file(s) onto the window.</li>
</ul>
<p>The app finds posts, archived posts, reels and IGTV videos. Stories, comments, likes and followers are not transferred.</p>`,
    },
    {
      id: 'import', title: '4. Select & import',
      html: `
<p>You’ll see every post that was found. At first, everything not yet imported is selected.</p>
<ul>
  <li>The <b>check mark</b> in the corner of each photo selects or deselects it. <b>Click the photo</b> for a preview with the final caption.</li>
  <li>Use the bar at the top to filter by type (posts, reels …), year or text. “Select all” applies to the posts currently shown.</li>
</ul>
<h4>Options</h4>
<ul>
  <li><b>Visibility:</b> <i>Unlisted</i> (recommended) shows posts on your profile without flooding public timelines. <i>Public</i> posts normally. <i>Followers only</i> is private.</li>
  <li><b>Original date:</b> Pixelfed gives every post today’s date and can’t take over the original one. So the app can add it below the caption. You can edit the text; <code>{date}</code> is replaced with the date.</li>
  <li><b>Sensitive:</b> Adds a content warning to all posts.</li>
  <li><b>Pause:</b> Time to wait between two posts. Many instances limit how fast you can post.</li>
</ul>
<h4>While importing</h4>
<ul>
  <li>Posts are uploaded <b>oldest first</b>, so your profile ends up in the right order.</li>
  <li><b>Pause</b> stops for now, <b>Resume</b> continues.</li>
  <li>You can also <b>stop or close the app</b>. It remembers what’s already imported. Next time, open the same export again (“Recently opened”) and only the remaining posts will be selected.</li>
  <li>If the server throttles (rate limit), the app waits automatically and retries.</li>
</ul>`,
    },
    {
      id: 'faq', title: 'Good to know',
      html: `
<dl class="faq">
  <dt>Why is the date wrong?</dt>
  <dd>Pixelfed doesn’t allow backdating through its API. Posts show the import date; the original date is in the caption.</dd>
  <dt>My album was split up</dt>
  <dd>Each instance sets how many photos a post may have. Bigger albums are spread over several posts marked “(1/2)”, “(2/2)”.</dd>
  <dt>The caption was shortened</dt>
  <dd>The instance also sets the maximum text length. Captions that are too long end with “…”.</dd>
  <dt>A video was skipped</dt>
  <dd>Some instances don’t accept videos or have a size limit. The log tells you when that happens.</dd>
  <dt>Can I import a post again?</dt>
  <dd>Yes: hover an imported post in the selection and click “Import again”. Delete the old post in Pixelfed first, or you’ll have it twice.</dd>
  <dt>Several Instagram accounts?</dt>
  <dd>Sign in with the matching Pixelfed account for each and open its export. Progress is remembered per Pixelfed account.</dd>
  <dt>Where does my data go?</dt>
  <dd>Only to this computer and your Pixelfed instance. There’s no server in between.</dd>
  <dt>What about @mentions and #hashtags?</dt>
  <dd>Hashtags work the same on Pixelfed. @mentions point to Pixelfed users with the same name, not to Instagram.</dd>
</dl>`,
    },
  ],
};
