/**
 * ======================================================================
 *  EVENT DETAILS: edit this one file to change what the website says.
 * ======================================================================
 *
 * Everything below is SAMPLE content so the site can be previewed.
 * Replace each value with your real event details, then set
 * `isSample` to false. While it is true, a strip at the top of every
 * public page warns visitors that the details are not real.
 *
 * Tips
 *  - Dates and times are written with "+08:00" (Philippine time).
 *  - Keep the quotes around text. Use ’ or plain ' for apostrophes.
 *  - After saving, commit and push to GitHub; Vercel redeploys by itself.
 */

export const event = {
  /** Shows the "sample details" warning strip. Set to false when the details are real. */
  isSample: true,

  /** Set to false to close registration (the form shows a "closed" notice). */
  registrationOpen: true,

  /** Event name, as large as it gets on the home page. Two short lines read best (about 30 characters). */
  name: "Partners Summit 2026",

  /** Short name for the top bar, the pass and browser tabs. */
  shortName: "Partners Summit",

  /** One plain sentence about the event, used under the heading and for search engines. */
  summary:
    "A full day with the people we work with: what we built this year, what comes next, and time to talk it through over lunch.",

  /** Heading for the "about" part of the home page (2 to 5 words). */
  aboutHeading: "One day, all our partners",

  /** Organiser name, used in the footer and the terms. */
  organizer: "Your Organisation Name",

  /** Letters before the number in reference codes, e.g. "EVT" gives EVT-0042. Capital letters and digits only. */
  referencePrefix: "EVT",

  /** Start and end, in Philippine time. */
  startsAt: "2026-11-26T08:00:00+08:00",
  endsAt: "2026-11-26T17:00:00+08:00",

  /** When the registration desk opens (free text). */
  doorsOpen: "7:30 AM",

  venue: {
    name: "Grand Ballroom",
    address: "Sample Hotel, Ayala Avenue",
    city: "Makati City",
    /** Link to the venue on Google Maps (or leave empty: ""). */
    mapUrl: "https://maps.google.com/?q=Makati+City",
    /**
     * Optional photo of the venue (or of last year's event), shown full width
     * under the event facts. Put the file in the "public" folder, for example
     * public/venue.jpg, then write src: "/venue.jpg" and describe it in alt.
     * Leave src as "" to show no photo.
     */
    photo: { src: "", alt: "" },
  },

  /** The programme, in order. Keep titles short: they are set very large. */
  schedule: [
    { time: "7:30 AM", title: "Registration", detail: "Pick up your pass and kit at the desk" },
    { time: "8:30 AM", title: "Opening", detail: "Welcome from the organisers" },
    { time: "9:00 AM", title: "Keynote", detail: "The year in review and the year ahead" },
    { time: "10:30 AM", title: "Panels", detail: "Three short panels with partners" },
    { time: "12:00 PM", title: "Lunch", detail: "Served in the ballroom foyer" },
    { time: "1:30 PM", title: "Workshops", detail: "Choose one of four rooms on the day" },
    { time: "4:00 PM", title: "Awards", detail: "Partner awards, then closing remarks" },
  ],

  /** Registration fee in Philippine pesos (number only, no commas). */
  fee: 2500,

  /** What the fee covers (one short sentence). */
  feeIncludes: "Covers lunch, two coffee breaks and the event kit.",

  /** Pay by this date and time (Philippine time). */
  paymentDeadline: "2026-11-19T23:59:00+08:00",

  /**
   * How people pay. Add or remove entries. Each one becomes a column on the
   * home page and a block in step 4 of the form.
   * SAMPLE numbers below are deliberately fake: replace them before sharing.
   */
  paymentMethods: [
    {
      name: "GCash",
      accountName: "Juan dela Cruz",
      accountNumber: "0900 000 0000",
      note: "Send Money to the number above, then screenshot the receipt.",
    },
    {
      name: "Bank transfer",
      bank: "Sample Bank",
      accountName: "Your Organisation Name",
      accountNumber: "0000 0000 0000",
      note: "Online transfer or over-the-counter deposit. Photograph the deposit slip.",
    },
  ] as PaymentMethod[],

  /** Event instructions: dress code, what to bring, arrival time. Shown on the home page and in step 2. */
  instructions: [
    {
      question: "What time should I arrive?",
      answer: "The registration desk opens at 7:30 AM. Please be seated by 8:20 AM; the programme starts on time.",
    },
    {
      question: "What should I wear?",
      answer: "Business casual. The ballroom is air-conditioned, so bring a light jacket.",
    },
    {
      question: "What do I bring?",
      answer: "A valid government-issued or company ID, and your reference code (a screenshot of your confirmation is fine).",
    },
    {
      question: "Is there parking?",
      answer: "Paid parking is available at the venue. Spaces are limited, so ride-hailing or public transport is easier.",
    },
    {
      question: "Can someone go in my place?",
      answer: "Yes, if you tell us by email at least three days before the event. Your replacement uses your reference code.",
    },
    {
      question: "Is lunch provided?",
      answer: "Yes. Email us about any food allergies or dietary needs at least a week before the event.",
    },
    {
      question: "When will my payment be verified?",
      answer: "We check receipts within two working days. Your status changes to Paid once it matches our records.",
    },
  ],

  /**
   * TERMS AND CONDITIONS: PLACEHOLDER.
   * Replace every paragraph below with your own terms before going live.
   */
  terms: [
    "[PLACEHOLDER TERMS: replace these paragraphs with your organisation's own terms and conditions before opening registration.]",
    "Registration is confirmed only after we verify your payment. The registration fee is non-refundable but transferable to another person from your organisation if you tell us at least three days before the event.",
    "We may change the programme, speakers or venue for reasons outside our control. If the event is cancelled, we will refund the full registration fee.",
    "Photographs and video may be taken at the event and used in our communications. Tell the registration desk if you prefer not to be photographed.",
  ],

  /**
   * Privacy notice (Republic Act No. 10173, the Data Privacy Act of 2012).
   * Review with your Data Protection Officer before going live.
   */
  privacy: {
    dataProtectionOfficer: "Data Protection Officer, Your Organisation Name",
    dpoEmail: "privacy@example.com",
    paragraphs: [
      "We collect your name, email address, mobile number, company, job title, payment reference number and payment receipt to register you for this event, verify your payment and prepare your event pass.",
      "Only the event organisers can see this information. It is stored securely and is not shared with anyone else except where the law requires it.",
      "We keep registration records for up to one year after the event, then delete them.",
      "Under the Data Privacy Act of 2012 you can ask to see, correct or delete your personal data, or withdraw your consent, by writing to our Data Protection Officer.",
    ],
  },

  /** Where people can ask questions. */
  contact: {
    email: "events@example.com",
    phone: "+63 2 8000 0000",
  },
};

export type PaymentMethod = {
  name: string;
  bank?: string;
  accountName: string;
  accountNumber: string;
  note?: string;
};

export type EventConfig = typeof event;
