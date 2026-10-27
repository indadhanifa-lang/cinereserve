import { describe, expect, it } from "vitest";
import { FAQS, matchFaq } from "./helpFaq";

const answerTo = (text: string) => matchFaq(text)?.question;

describe("matchFaq", () => {
  it("matches a tapped suggestion exactly", () => {
    FAQS.forEach((faq) => expect(answerTo(faq.question)).toBe(faq.question));
  });

  it("routes typed questions by keyword, specific intents first", () => {
    expect(answerTo("cancel my ticket")).toBe("Can I cancel or get a refund?");
    expect(answerTo("How much is a ticket?")).toBe("Why do some seats cost more?");
    expect(answerTo("where is my ticket")).toBe("Where is my ticket?");
    expect(answerTo("I have a pending payment")).toBe("I left before paying. What now?");
    expect(answerTo("can I pay with GCash")).toBe("What payment methods can I use?");
    expect(answerTo("unsaon pag book")).toBe("How do I book a ticket?");
    expect(answerTo("pila ka minuto ang hold")).toBe("How long are my seats held?");
    expect(answerTo("unsay salida karon")).toBe("What's showing today?");
  });

  it("returns nothing for unknown questions", () => {
    expect(matchFaq("is there parking?")).toBeUndefined();
    expect(matchFaq("   ")).toBeUndefined();
  });
});
