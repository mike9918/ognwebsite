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
    "Start your server from Discord",
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
      question: "Can I upload mods?",
      answer: "Yes. You will be able to upload your own mods and files over SFTP.",
    },
    {
      question: "Can you restore my old PloudOS backup?",
      answer:
        "If you still have the files, you will be able to upload them. OpenGameNode cannot recover anything from PloudOS.",
    },
    {
      question: "Who runs this?",
      answer: "OpenGameNode is run by MH Tech Solutions.",
    },
  ],
  footerDisclaimer:
    "OpenGameNode is not affiliated with PloudOS or its creator. NOT AN OFFICIAL MINECRAFT SERVICE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.",
  copyright: "© 2026 MH Tech Solutions",
  navWaitlist: "Waitlist",
  termsLink: "Terms",
  privacyLink: "Privacy",
  months: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  form: {
    heading: "Join the waitlist",
    monthLabel: "Birth month",
    yearLabel: "Birth year",
    monthPlaceholder: "Month",
    yearPlaceholder: "Year",
    emailLabel: "Email",
    discordLabel: "Discord username (optional)",
    runLegend: "What will you run?",
    vanilla: "Vanilla",
    plugins: "Plugins (Paper)",
    modpack: "Modpack",
    detailLabel: "Modpack or version (optional)",
    submit: "Join the waitlist",
    discordButton: "Continue with Discord",
  },
  success: {
    heading: "You're on the list.",
    existing: "This email was already on the list.",
    reached: "We'll reach you at {email}.",
    place: "Your place is {position}.",
    referral: "Each friend who joins moves you up the list.",
    linkLabel: "Your link",
    copy: "Copy link",
    copied: "Copied",
    discord: "Join the Discord",
  },
  ageBlocked: "Sorry, you can't join right now.",
  errors: {
    validation: "Check the form and try again.",
    email: "Enter your email.",
    runType: "Choose what you'll run.",
    birth: "Choose a month and year.",
    turnstile: "We couldn't confirm that submission. Please try again.",
    rate: "Too many sign-ups from this network. Please try again later.",
    discord: "Discord sign-in didn't complete. Join with your email instead.",
    discordEmail:
      "Discord didn't share an email address. Join with your email instead.",
    unavailable: "Sign-up isn't available right now.",
    generic: "Something went wrong. Please try again.",
  },
  terms: {
    title: "Terms",
    body: "These terms are a placeholder. The full terms are not published yet.",
  },
  privacy: {
    title: "Privacy",
    body: "This privacy notice is a placeholder. The full notice is not published yet.",
  },
  notFound: {
    title: "That page isn't here.",
    body: "The link may be old, or the page may have moved.",
    home: "Back home",
  },
} as const;

export type RunType = "vanilla" | "plugins" | "modpack";

export const RUN_TYPES: readonly RunType[] = ["vanilla", "plugins", "modpack"];
