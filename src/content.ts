// All visitor-facing copy lives here so AUD-16 can replace it in one file.

export const content = {
  name: "OpenGameNode",
  description:
    "Free game servers from OpenGameNode. Join the waitlist for a Minecraft server.",
  headline: "Free game servers. More time to play.",
  supporting: "Start a server. Invite your friends. Make it yours.",
  tagline: "Your game. Your server. Open to everyone.",
  primaryAction: "Join the waitlist",
  minecraftNote: "Minecraft is the only game at launch.",
  featuresHeading: "What you get",
  featuresIntro: "Minecraft is the only game at launch.",
  features: [
    {
      title: "Instant start",
      body: "No queue in normal use.",
    },
    {
      title: "Your mods and files",
      body: "Upload your own mods and files over SFTP.",
    },
    {
      title: "A simple panel",
      body: "Ads never block the controls.",
    },
  ],
  facts: [
    "2 GB RAM for vanilla and plugins",
    "3 GB RAM for modded",
    "Low latency for North America",
    "Manage your server from the panel",
  ],
  faqHeading: "Questions",
  faq: [
    {
      question: "Is it really free?",
      answer:
        "Yes. OpenGameNode is free and ad-supported. Ads will not cover the controls.",
    },
    {
      question: "Why a waitlist?",
      answer:
        "Servers are not open yet. Invites go out in small groups so the first servers stay fast.",
    },
    {
      question: "Why Discord to join?",
      answer:
        "We use Discord so each person gets one spot. We never post or send DMs on your behalf. We only read your Discord id, username, and verified email to put you on the list.",
    },
    {
      question: "Can I upload mods?",
      answer: "Yes. You will be able to upload your own mods and files over SFTP.",
    },
    {
      question: "Can I bring my own world backup or server backup?",
      answer:
        "Yes. If you still have the files, you will be able to upload them over SFTP. OpenGameNode cannot recover files from another host for you.",
    },
    {
      question: "Who runs this?",
      answer: "OpenGameNode. Join the Discord for more information.",
    },
  ],
  footerDisclaimer:
    "NOT AN OFFICIAL MINECRAFT SERVICE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.",
  navWaitlist: "Waitlist",
  termsLink: "Terms",
  privacyLink: "Privacy",
  form: {
    heading: "Join the waitlist",
    intro:
      "Sign in with Discord so each person gets one spot. We never post or DM on your behalf.",
    runLegend: "What will you run?",
    vanilla: "Vanilla",
    plugins: "Plugins (Paper)",
    modpack: "Modpack",
    detailLabel: "Modpack or version (optional)",
    discordButton: "Continue with Discord",
  },
  success: {
    heading: "You're on the list.",
    existing: "This Discord account was already on the list.",
    reached: "We'll reach you at {email}.",
    place: "Your place is {position}.",
    referral: "Each friend who joins moves you up the list.",
    linkLabel: "Your link",
    copy: "Copy link",
    copied: "Copied",
    discord: "Join the Discord",
  },
  errors: {
    validation: "Check the form and try again.",
    runType: "Choose what you'll run.",
    turnstile: "We couldn't confirm that submission. Please try again.",
    rate: "Too many sign-ups from this network. Please try again later.",
    discord: "Discord sign-in didn't complete. Please try again.",
    discordEmail: "Verify the email on your Discord account, then try again.",
    discordNew: "That Discord account is too new to join right now. Try again later.",
    closed: "The waitlist is closed right now.",
    full: "The waitlist is full right now.",
    unavailable: "Sign-up isn't available right now.",
    generic: "Something went wrong. Please try again.",
  },
  admin: {
    saved: "Settings saved.",
    deleted: "Waitlist entry deleted.",
    deleteMissing: "That waitlist entry was already gone.",
    delete: "Delete",
    provision: "Provision",
    forbidden: "That Discord account is not allowed to manage the waitlist.",
    discordFailed: "Discord sign-in didn't complete. Please try again.",
    unavailable: "Admin sign-in isn't configured yet.",
  },
  terms: {
    title: "OpenGameNode Terms",
    body: "These OpenGameNode terms are a placeholder. The full terms are not published yet.",
  },
  privacy: {
    title: "OpenGameNode Privacy",
    body: "This OpenGameNode privacy notice is a placeholder. The full notice is not published yet.",
  },
  notFound: {
    title: "That page isn't here.",
    body: "The link may be old, or the page may have moved.",
    home: "Back home",
  },
} as const;

export type RunType = "vanilla" | "plugins" | "modpack";

export const RUN_TYPES: readonly RunType[] = ["vanilla", "plugins", "modpack"];
