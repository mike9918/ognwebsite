// All visitor-facing copy lives here so AUD-16 can replace it in one file.

export const content = {
  name: "OpenGameNode",
  siteOrigin: "https://opengamenode.com",
  description:
    "Free Minecraft server hosting from OpenGameNode. Sign up free with Discord, start a server, invite your friends, keep your world.",
  tagline: "Your game. Your server. Open to everyone.",
  headline: "Free game servers. More time to play.",
  supporting: "Start a server. Invite your friends. Make it yours.",
  minecraftNote: "Minecraft is the only game at launch.",
  panelUrl: "https://panel.opengamenode.com",
  nav: {
    faq: "FAQ",
    supporter: "Supporter",
    help: "Help",
    panel: "Sign in",
  },
  home: {
    lead:
      "Free, ad-supported hosting with a four-hour session, a simple panel and no ad before you press Start. Sign up free with Discord and your server is waiting in the panel.",
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
        body: "Choose vanilla, plugins on Paper, or a modpack. Your server is created for you, stopped, and waiting in the panel.",
      },
      {
        title: "Invite your friends",
        body: "Share the address from your server page. Players join with Minecraft — they don't need an account here. Your world and files stay saved between sessions.",
      },
    ],
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
    facts: [
      "2 GB RAM for vanilla and plugins",
      "3 GB RAM for modded",
      "Low latency for North America",
      "Manage your server from the panel",
    ],
    sessionsHeading: "Sessions, in plain English",
    sessions: [
      {
        title: "About four hours per start",
        body: "Every Start gives you a session of about four hours, with a countdown on your server page.",
      },
      {
        title: "Extend once a day",
        body: "In the last ten minutes of a session you can click Extend to add about four more hours, once per day.",
      },
      {
        title: "Quiet servers sleep",
        body: "Five minutes with nobody online and the server shuts off to free room for others. Your world and files are saved, and Start brings it back for a fresh session.",
      },
    ],
    gamesHeading: "Games",
    gamesBody:
      "Vanilla, plugins on Paper, or a modpack. One game, done properly, instead of a long list we can't support yet.",
    supporterHeading: "OpenGameNode Supporter",
    supporterBody:
      "No ads, priority start when the node is full, +1 GB RAM and a Discord role. $1.99 a month, cancel anytime.",
    supporterLink: "About Supporter",
    faqHeading: "Questions",
    faqMore: "See all questions",
    communityHeading: "Community",
    communityBody:
      "Support, help and server talk happen in our Discord. Email support@opengamenode.com if you'd rather not join.",
    joinDiscord: "Join the Discord",
  },
  faqHeading: "Questions",
  faq: [
    {
      question: "Is it really free?",
      answer:
        "Yes. Free Minecraft servers, paid for by one small display ad per panel page. Supporter ($1.99/month) is optional and just removes ads and adds a few extras.",
    },
    {
      question: "How do I sign up?",
      answer:
        "Tap Sign up free with Discord on the homepage, pick what you're running, and sign in with Discord. We create your panel account from your verified Discord email, so there's no form to fill in and no password to set up. You can start your server from the panel right away.",
    },
    {
      question: "How long does my server run?",
      answer:
        "Each start gives you about 4 hours, with a countdown on your server page. In the last 10 minutes you can click Extend to add about 4 more hours, once per day. If nobody's on for 5 minutes, the server shuts off and that session ends. Click Start in the panel for a fresh 4 hours. Players joining won't start it. Separately, you're signed out of the panel after an hour of inactivity, but your servers keep running.",
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
        "$1.99/month for no ads, priority start, +1 GB RAM and a Discord Supporter role, with more perks later. Cancel anytime through Stripe and keep your perks until the period ends. Full refund within 7 days of your first charge.",
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
    lead: "Go ad-free and get a little extra.",
    perks: [
      "No ads anywhere in the panel.",
      "Priority start — you jump ahead when the node is full. Priority, not a guaranteed spot.",
      "+1 GB RAM on your server.",
      "Supporter role in our Discord.",
      "More perks later as we grow.",
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
      "Practical guides for the things people ask about most: starting a server, inviting friends, moving a world, backups and billing.",
    more: "Something else? Ask in our Discord or email support@opengamenode.com.",
    back: "All help guides",
  },
  legal: {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    aup: "Acceptable Use Policy",
    updatedLabel: "Last updated:",
    updated: "2 November 2026",
  },
  footer: {
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
  // and "problem" is a failure the admin table can retry.
  success: {
    heading: "You're signed up.",
    existing: "You already have an account with this Discord, so we've kept it.",
    preparing:
      "Your sign-up is confirmed and we're setting up your server now. We'll DM or email you as soon as it's ready — this page updates too.",
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
      "New sign-ups are paused while we free up room. Spots reopen as servers go quiet, so check back soon. You can still say hello in our Discord.",
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
  },
  provision: {
    dmIntro: "Your OpenGameNode server is ready.",
    dmNote: "You signed up as {email}. Sign in with that address and press Start when you want to play.",
    dmNoteDiscord:
      "Sign in at {panel} with Discord — your account is already linked, so there's no password to set up. Press Start when you want to play.",
    emailSubject: "Your OpenGameNode server is ready",
    emailIntro: "Your server is ready.",
    emailNote:
      "You signed up as {email}. If you don't have a panel password yet, use “Forgot password” on the panel sign-in page.",
    emailNoteDiscord:
      "Sign in at {panel} with Discord — your account is already linked, so there's no password to remember. If you'd rather use an email password, choose “Forgot password”.",
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
      ref: "Ref",
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
