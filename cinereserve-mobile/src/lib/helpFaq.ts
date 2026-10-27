export interface Faq {
  question: string;
  answer: string;
  /** Lower-case words (English and Bisaya) that route a typed question here. */
  keywords: string[];
  action?: { label: string; path: string };
}

// Offline fallback for the help chat when the AI is unavailable: typed text
// matches by keyword (an exact question also matches).
// Order matters — the first FAQ with a matching keyword wins, so the more
// specific questions sit before the broad ones ("cancel my ticket" → Cancel).
export const FAQS: Faq[] = [
  {
    question: "How do I book a ticket?",
    answer:
      "1. Open Movies and tap a poster.\n2. Tap View Showtimes and pick a time.\n3. Choose your seats and tap Continue.\n4. Pay within the hold timer to get your ticket.",
    keywords: ["book", "reserve"],
    action: { label: "Browse Movies", path: "/movies" },
  },
  {
    question: "What's showing today?",
    answer:
      "Check Showing Today on Home, or open Movies and tap Now Showing. You can also filter by branch and genre.",
    keywords: ["showing", "today", "salida", "karon", "schedule", "showtime"],
    action: { label: "Open Movies", path: "/movies" },
  },
  {
    question: "I left before paying. What now?",
    answer:
      "Your reservation waits under Pending Payment on Home while the hold timer is running. Tap Continue Payment to finish it.",
    keywords: ["pending", "left", "unpaid", "wala nabayran"],
    action: { label: "Go to Home", path: "/home" },
  },
  {
    question: "Can I cancel or get a refund?",
    answer:
      "Bookings can't be cancelled in the app yet. Please contact the cinema branch for help.",
    keywords: ["cancel", "refund", "kanselar", "ibalik"],
  },
  {
    question: "How long are my seats held?",
    answer:
      "Seats are held for 10 minutes after you continue to payment. The timer is shown on the Payment page — pay before it runs out or the seats are released.",
    keywords: ["hold", "held", "expire", "timer", "minute", "minuto"],
  },
  {
    question: "Why do some seats cost more?",
    answer: "Some seats include a premium for a better view or comfort. The price is shown when you select the seat.",
    keywords: ["price", "premium", "cost", "how much", "presyo", "mahal", "pila"],
  },
  {
    question: "Where is my ticket?",
    answer:
      "Paid tickets are in the Tickets tab. Show the ticket code at the cinema entrance.",
    keywords: ["ticket", "qr", "code"],
    action: { label: "Open Tickets", path: "/tickets" },
  },
  {
    question: "What payment methods can I use?",
    answer: "You can pay with GCash or a credit/debit card (Visa, Mastercard).",
    keywords: ["pay", "gcash", "card", "bayad", "method"],
  },
  {
    question: "How do I update my profile?",
    answer: "Go to Profile, then Personal Information to change your name, phone, or photo.",
    keywords: ["profile", "name", "phone", "photo", "avatar", "account"],
    action: { label: "Open Profile", path: "/profile" },
  },
];

/** Tapped chip = exact question; typed text = first FAQ with a keyword in it. */
export const matchFaq = (text: string): Faq | undefined => {
  const lower = text.trim().toLowerCase();
  return (
    FAQS.find((f) => f.question === text.trim()) ??
    FAQS.find((f) => f.keywords.some((k) => lower.includes(k)))
  );
};
