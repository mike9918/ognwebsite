// All visitor-facing copy lives here so AUD-16 can replace it in one file.

export const content = {
  name: "OpenGameNode",
  siteOrigin: "https://opengamenode.com",
  description:
    "OpenGameNode hosts free Minecraft Java servers. Sign up with Discord, start a server, invite your friends, and keep your world.",
  tagline: "Your game. Your server. Open to everyone.",
  headline: "Free Minecraft server hosting",
  supporting: "Free game servers. More time to play.",
  minecraftNote: "Minecraft Java is the game at launch. Bedrock isn't offered.",
  panelUrl: "https://panel.opengamenode.com",
  nav: {
    minecraft: "Free server",
    faq: "FAQ",
    supporter: "Supporter",
    help: "Help",
    panel: "Sign in",
    signup: "Sign up free",
  },
  home: {
    lead:
      "OpenGameNode is free Minecraft server hosting. Sign up with Discord, pick vanilla, Paper, or a modpack, and we set up your server. A session runs about four hours, your world stays saved, and there's no ad before you press Start.",
    primaryAction: "Sign up free with Discord",
    secondaryAction: "Sign in to the panel",
    signupHeading: "Sign up free",
    stepsHeading: "How it works",
    stepsIntro: "Three steps from signing up to your first session.",
    steps: [
      {
        title: "Sign up with Discord",
        body: "One tap, one account, no password to invent. We use your verified Discord email to create your panel account. We never post or send DMs on your behalf.",
      },
      {
        title: "Pick what you're running",
        body: "Choose vanilla, plugins on Paper, or a modpack. We create your server stopped and ready in the panel after sign-up.",
      },
      {
        title: "Invite your friends",
        body: "Share the address from your server page. Players join with Minecraft — they don't need an account here. Your world and files stay saved between sessions.",
      },
    ],
    specsLink: "See free server specs",
    honestHeading: "What free means",
    honestBody:
      "OpenGameNode stays free because of one small ad on each panel page. A session is about four hours, not a server that stays online all day. When it sleeps, your world and files stay saved.",
    honestLink: "Free Minecraft server hosting, in detail",
    featuresHeading: "What you get",
    features: [
      {
        title: "Instant start",
        body:
          "Click Start and your server comes up. A server only queues if 4 others are already starting or the node is full.",
      },
      {
        title: "Your mods and files",
        body: "Upload your own mods and files over SFTP.",
      },
      {
        title: "A simple panel",
        body: "Ads never block the controls, and you never watch an ad to start a server.",
      },
    ],
    sessionsHeading: "Sessions, in plain English",
    sessions: [
      {
        title: "About four hours per start",
        body: "Every Start gives you a session of about four hours, with a countdown on your server page.",
      },
      {
        title: "Extend twice a day",
        body: "In the last ten minutes you can click Extend to add about four more hours. You can do that twice a day.",
      },
      {
        title: "Quiet servers sleep",
        body: "Five minutes with nobody online and the server shuts off to free room for others. Your world and files are saved, and Start brings it back for a fresh session.",
      },
    ],
    gamesHeading: "Pick a Minecraft server",
    gamesBody:
      "Vanilla, plugins on Paper, or a modpack. Minecraft Java is the game at launch — Bedrock isn't offered.",
    serverTypes: [
      {
        runType: "vanilla",
        title: "Vanilla",
        body: "Plain Minecraft Java, with nothing extra installed.",
        image: "/art/vanilla-plains.jpg",
        imageAlt: "A timber cottage and wheat field in a block-built forest",
        width: 960,
        height: 720,
      },
      {
        runType: "plugins",
        title: "Paper",
        body: "Plugins on Paper. Upload your own files over SFTP.",
        image: "/art/plugins-workshop.jpg",
        imageAlt: "A stone workshop of pipes, gears, and lanterns",
        width: 960,
        height: 720,
      },
      {
        runType: "modpack",
        title: "Modpack",
        body: "A curated set of mods, with 3 GB of RAM instead of 2.",
        image: "/art/modpack-islands.jpg",
        imageAlt: "Floating islands, a crystal spire, and a wooden airship",
        width: 1152,
        height: 864,
      },
    ],
    modpackHeading: "Bring a modpack",
    modpackBody:
      "A modpack is a set of mods that already fit together: machines, magic, exploration, or a kitchen-sink world with some of each. Pick Modpack when you sign up. Free servers get 3 GB of RAM for it, and you upload the pack over SFTP.",
    modpackSoon:
      "Supporters will get one-click modpack installers. That part is coming soon, and it is not in the panel yet.",
    supporterHeading: "OpenGameNode Supporter",
    supporterBody:
      "No ads, no four-hour cap, priority start, and +2 GB RAM. $1.99 a month. One-click modpack installers and a player manager are coming soon.",
    supporterLink: "About Supporter",
    faqHeading: "Questions",
    faqMore: "See all questions",
    communityHeading: "Community",
    communityBody:
      "Support, help and server talk happen in our Discord. Email support@opengamenode.com if you'd rather not join.",
    joinDiscord: "Join the Discord",
  },
  landing: {
    lede:
      "OpenGameNode hosts a free Minecraft Java server you can start with Discord. Pick vanilla, Paper plugins, or a modpack. Your world stays saved between sessions, and you never watch an ad before you press Start.",
    specsHeading: "What a free server includes",
    specsIntro:
      "One server on the free plan. These are the limits the panel actually creates, not a teaser that shrinks after you sign up.",
    sharedHeading: "On every free server",
    limitsHeading: "What free does not mean",
    limits: [
      "It is not a 24/7 server. Each Start runs for about four hours, and the server sleeps after five minutes with nobody online.",
      "It is Minecraft Java. Bedrock Edition isn't offered.",
      "Friends can join without an account, but only you can press Start.",
      "Ads keep the free plan free: one small display ad per panel page. Nothing in-game, nothing over the console, and no ad before Start.",
      "Keep your own backup of the world. The panel includes one backup slot, and free hosting is best-effort.",
    ],
    startHeading: "From sign-up to your first session",
    region: "Low latency for North America.",
  },
  faqHeading: "Questions",
  faq: [
    {
      question: "Is it really free?",
      answer:
        "Yes. Free Minecraft servers, paid for by one small display ad per panel page. Supporter ($1.99/month) is optional: it removes ads, removes the four-hour cap, and adds 2 GB of RAM.",
    },
    {
      question: "How do I sign up?",
      answer:
        "Tap Sign up free with Discord on the homepage, pick what you're running, and sign in with Discord. We create your panel account from your verified Discord email, so there's no form to fill in and no password to set up. We'll DM or email you when your server is ready to Start in the panel.",
    },
    {
      question: "Can I run plugins or a modpack?",
      answer:
        "Yes. Choose plugins for a Paper server, or a modpack if you're running a curated set of mods. You can upload mods and files over SFTP. It's Minecraft Java — Bedrock isn't offered.",
    },
    {
      question: "Do my friends need an account?",
      answer:
        "No. Share the address from your server page and they join with Minecraft. They don't need an OpenGameNode account. Only the owner can press Start, and a player joining won't turn a sleeping server back on.",
    },
    {
      question: "Is it Java or Bedrock?",
      answer:
        "Java. OpenGameNode runs Minecraft Java: vanilla, plugins on Paper, or a modpack. Bedrock Edition isn't offered.",
    },
    {
      question: "How long does my server run?",
      answer:
        "Each start gives you about 4 hours, with a countdown on your server page. In the last 10 minutes you can click Extend to add about 4 more hours, twice a day. If nobody's on for 5 minutes, the server shuts off and that session ends. Click Start in the panel for a fresh 4 hours. Players joining won't start it. Supporter servers are not cut off after four hours. Separately, you're signed out of the panel after an hour of inactivity, but your servers keep running.",
    },
    {
      question: "What happens when nobody's online?",
      answer:
        "After 5 minutes with nobody on, your server shuts off to free up room for others. Your world and files are saved. A player joining won't turn it back on. The owner has to click Start in the panel, which begins a fresh 4-hour session.",
    },
    {
      question: "Is there a queue?",
      answer:
        "A server queues only if 4 others are already starting or the node is full. Supporters get priority, which is not a guaranteed spot.",
    },
    {
      question: "Why are there ads?",
      answer:
        "Ads keep OpenGameNode free. There's one ad per panel page — never in-game, never over the console, no pop-ups, and you never have to watch an ad to start your server.",
    },
    {
      question: "Can I use an ad blocker?",
      answer:
        "Yes, your server works either way. If you'd like to help keep us running, please allowlist panel.opengamenode.com or get Supporter.",
    },
    {
      question: "What's Supporter?",
      answer:
        "$1.99/month for no ads, no four-hour session cap, priority start, +2 GB RAM and a Discord Supporter role. One-click modpack installers and a player manager are coming soon and are not in the panel yet. Cancel anytime through Stripe and keep your perks until the period ends. Full refund within 7 days of your first charge.",
    },
    {
      question: "Who can use it?",
      answer:
        "Anyone with a Discord account who is 16 or older in the EU and EEA, or 13 or older everywhere else. If you're under 18, you need a parent or guardian's OK to use OpenGameNode and to buy Supporter.",
    },
    {
      question: "How do I get help?",
      answer: "Ask in our Discord or email support@opengamenode.com.",
    },
  ],
  supporter: {
    heading: "Supporter",
    tagline: "Optional, and it keeps the ads off",
    price: "$1.99",
    period: "/month",
    lead: "No ads, no four-hour cap, and a bit more room to play.",
    perks: [
      "No ads anywhere in the panel.",
      "No four-hour session cap. A server with nobody on it for five minutes still sleeps, and the world stays saved.",
      "Priority start — you jump ahead when the node is full. Priority, not a guaranteed spot.",
      "+2 GB RAM on your server.",
      "Supporter role in our Discord.",
      "One-click modpack installers, coming soon.",
      "A player manager, coming soon.",
    ],
    billing:
      "Payments go through Stripe, and we never see or store your full card number. Cancel anytime through Stripe — canceling stops the next charge and you keep your perks until the end of the period you've already paid for.",
    refunds: [
      "We don't give refunds for partial months.",
      "Ask within 7 days of your first charge and we'll refund it in full.",
      "If we bill you by mistake, we'll always refund it.",
      "Refunds go back through Stripe to your original payment method.",
    ],
    age: "Under 18? You need a parent or guardian's OK before you subscribe.",
    cta: "Become a Supporter",
    ctaNote:
      "Supporter billing isn't open yet. We'll announce it on the site and in our Discord.",
    adNote:
      "Ads only ever appear inside the panel, one per page. There are no ads on this site.",
  },
  help: {
    heading: "Help guides",
    tagline: "Short answers, no support ticket",
    intro:
      "Practical guides for the things people ask about most: starting a Minecraft server, inviting friends, moving a world, backups and billing.",
    more: "Something else? Ask in our Discord or email support@opengamenode.com.",
    back: "All help guides",
  },
  legal: {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    aup: "Acceptable Use Policy",
    updatedLabel: "Last updated:",
    updated: "13 November 2026",
  },
  footer: {
    nameLine: "OpenGameNode (Open Game Node, OGN).",
    operator:
      "OpenGameNode is operated by MH Tech Solutions. Contact: support@opengamenode.com",
    minecraft:
      "NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.",
  },
  form: {
    heading: "Sign up free",
    intro:
      "Sign up with Discord to get your free server. We use your verified Discord email to create your panel account, and we may DM you there when your server is ready. We never message on your behalf.",
    runLegend: "What will you run?",
    vanilla: "Vanilla",
    plugins: "Plugins (Paper)",
    modpack: "Modpack",
    detailLabel: "Modpack or version (optional)",
    discordButton: "Sign up free with Discord",
  },
  // The sign-up screen becomes a status page once a row exists. "preparing" is
  // a server that is queued or being created, "ready" is a finished provision,
  // and "problem" is a failure the admin table can retry. Preparing copy depends
  // on Automatic vs Manual provisioning (AUD-66 / AUD-67).
  success: {
    heading: "You're signed up.",
    existing: "You already have an account with this Discord, so we've kept it.",
    preparingAutomatic:
      "Your sign-up is confirmed and we're setting up your server now. We'll DM or email you as soon as it's ready.",
    preparingManual:
      "Thanks — we've got your Discord account. We'll notify you by Discord DM and email when your server is ready to Start.",
    ready: "Your server is ready. Open the panel and press Start when you want to play.",
    problem:
      "Your sign-up is saved, but we hit a problem creating your server. Our team can see it and retry. Ask in our Discord if you'd like an update.",
    emailNote: "We'll use {email} if we need to reach you.",
    panelAction: "Open the panel",
    discord: "Open OGN Discord",
    screening:
      "Open OGN Discord and complete any server rules or membership screening. Joining does not override your DM privacy settings.",
  },
  errors: {
    validation: "Check the form and try again.",
    runType: "Choose what you'll run.",
    turnstile: "We couldn't confirm that submission. Please try again.",
    rate: "Too many sign-ups from this network. Please try again later.",
    discord: "Discord sign-in didn't complete. Please try again.",
    discordJoin:
      "We could not add you to OGN Discord. Your signup is not complete. Your choices are saved for 10 minutes; connect Discord again to retry.",
    discordConflict:
      "That email is linked to a different sign-up. Sign in with your original Discord account or contact support@opengamenode.com.",
    discordEmail: "Verify the email on your Discord account, then try again.",
    discordNew: "That Discord account is too new to sign up right now. Try again later.",
    closed: "Sign-ups are paused right now. Check back soon.",
    full: "We're not taking new sign-ups for a moment. Spots reopen as servers free up.",
    unavailable: "Sign-up isn't available right now.",
    generic: "Something went wrong. Please try again.",
  },
  // Shown in place of the sign-up button when the backend capacity flag says the
  // free slots are taken. The cap value is never shown.
  capacity: {
    heading: "At capacity right now",
    body:
      "OpenGameNode isn't taking new free sign-ups at the moment. Please check back soon — the sign-up button will return when there's room again. You can still say hello in our Discord.",
    discord: "Join the Discord",
  },
  admin: {
    saved: "Settings saved.",
    deleted: "Sign-up deleted.",
    deleteMissing: "That sign-up was already gone.",
    delete: "Delete",
    provision: "Provision",
    provisionRetry: "Retry provision",
    provisionRunning: "Provisioning…",
    provisionQueued: "Setting up…",
    provisionPending: "Waiting for Provision",
    provisionStale: "Stuck provisioning — safe to retry",
    provisionedLabel: "Provisioned",
    openServer: "Open server",
    provisioned: "Provisioned: panel account, server and notifications are done.",
    provisionFailed: "Provisioning failed. Fix the cause and retry.",
    provisionBusy: "That sign-up is already being provisioned.",
    provisionUnavailable: "Provisioning is not configured yet.",
    forbidden: "That Discord account is not allowed to manage sign-ups.",
    discordFailed: "Discord sign-in didn't complete. Please try again.",
    unavailable: "Admin sign-in isn't configured yet.",
    atCapacity: "At capacity",
    capacityNote: "Free slots used",
    modeManual: "Manual — staff click Provision",
    modeAutomatic: "Automatic — provision after sign-up",
    modeNote:
      "Cap applies in both modes. Automatic needs panel and mail settings; otherwise rows stay queued until you provision by hand.",
    tableNoteManual:
      "Sign-ups arrive queued. Provision creates the Calagopus account and server, then DMs and emails the user.",
    tableNoteAutomatic:
      "Automatic mode starts provisioning after Discord sign-up. Provision stays available as a retry path.",
  },
  provision: {
    dmIntro: "Your OpenGameNode server is ready.",
    dmNote: "You signed up as {email}. Sign in with that address and press Start when you want to play.",
    dmNoteDiscord:
      "Sign in at {panel} with Discord — your account is already linked, so there's no password to set up. Press Start when you want to play. A server only queues if 4 others are already starting or the node is full.",
    emailSubject: "Your OpenGameNode server is ready",
    emailIntro: "Your server is ready.",
    emailNote:
      "You signed up as {email}. If you don't have a panel password yet, use “Forgot password” on the panel sign-in page.",
    emailNoteDiscord:
      "Sign in at {panel} with Discord — your account is already linked, so there's no password to remember. If you'd rather use an email password, choose “Forgot password”. A server only queues if 4 others are already starting or the node is full.",
    labels: {
      server: "Server",
      plan: "Plan",
      panel: "Panel",
      email: "Email",
    },
    closing: "Questions? Email support@opengamenode.com or ask in the Discord.",
  },
  // Staff-facing card in the Discord ops channel.
  board: {
    heading: "📥 New sign-up",
    headingProvisioned: "✅ Provisioned",
    notLinked: "none",
    labels: {
      discord: "Discord",
      email: "Email",
      plan: "Plan",
      wants: "Wants",
      ref: "Code",
      joined: "Joined",
      server: "Server",
      panelUser: "Panel user",
    },
  },
  notFound: {
    title: "That page isn't here.",
    body: "The link may be old, or the page may have moved.",
    home: "Back home",
  },
} as const;

export type RunType = "vanilla" | "plugins" | "modpack";

export const RUN_TYPES: readonly RunType[] = ["vanilla", "plugins", "modpack"];
