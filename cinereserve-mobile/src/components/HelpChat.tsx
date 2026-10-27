import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IonIcon, useIonRouter } from "@ionic/react";
import { chatbubbleEllipses, closeOutline, sendOutline, sparkles } from "ionicons/icons";
import { apiPostAuth } from "../lib/api";
import { matchFaq, type Faq } from "../lib/helpFaq";
import { navigate } from "../lib/nav";
import "./HelpChat.css";

interface Message {
  from: "bot" | "user";
  text: string;
  action?: Faq["action"];
}

/** "Hi Juan! …" — first name only; plain "Hi!" until the profile loads. */
const greeting = (customerName?: string | null): Message => {
  const firstName = customerName?.trim().split(/\s+/)[0];
  return {
    from: "bot",
    text: `Hi${firstName ? ` ${firstName}` : ""}! I'm the CineReserve helper. Ask me anything about movies, showtimes, bookings or payments.`,
  };
};

const FALLBACK = "Sorry, I can't answer that right now. Please try again in a moment.";

/** Recent turns sent to the AI (the API accepts at most 20). */
const HISTORY_LIMIT = 12;

/** Chat history → API turns, oldest first, starting with a customer turn. */
const toTurns = (messages: Message[]) => {
  const recent = messages.slice(-HISTORY_LIMIT);
  const firstUser = recent.findIndex((m) => m.from === "user");
  return recent.slice(firstUser).map((m) => ({
    role: m.from === "user" ? "user" : "assistant",
    text: m.text,
  }));
};

// One chat shared by every page that shows the button (Home and Movies stay
// mounted side by side), so the conversation follows the customer around.
interface ChatState {
  conversation: Message[];
  typing: boolean;
  // The greeting counts as unread until the chat is opened once.
  unread: boolean;
}

const INITIAL_CHAT: ChatState = { conversation: [], typing: false, unread: true };
let chat = INITIAL_CHAT;
const listeners = new Set<() => void>();

const setChat = (update: (state: ChatState) => Partial<ChatState>) => {
  chat = { ...chat, ...update(chat) };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Forget the conversation (on logout, so the next customer starts fresh). */
export const resetHelpChat = () => setChat(() => INITIAL_CHAT);

const BotAvatar: React.FC = () => (
  <span className="help-chat__avatar" aria-hidden="true">
    <IonIcon icon={sparkles} />
  </span>
);

/** Messenger-style floating chat: a round button that pops a chat window out
 * of the bottom-right corner. Shown on Home and Movies. */
const HelpChat: React.FC<{ customerName?: string | null }> = ({ customerName }) => {
  const router = useIonRouter();
  const [open, setOpen] = useState(false);
  const { conversation, typing, unread } = useSyncExternalStore(subscribe, () => chat);
  // Greeting is derived (not stored) so the name fills in once the profile loads.
  const messages = [greeting(customerName), ...conversation];
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  const toggle = () => {
    setOpen((value) => !value);
    setChat(() => ({ unread: false }));
  };

  // The AI (Gemini, via our backend) answers; if it is down or out of free
  // quota, the built-in FAQ answers instead so the chat never dead-ends.
  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || chat.typing) return;
    setChat((state) => ({
      conversation: [...state.conversation, { from: "user", text: question }],
      typing: true,
    }));
    setDraft("");

    let reply: Message;
    try {
      const { reply: answer } = await apiPostAuth<{ reply: string }>("/customer/assistant", {
        messages: toTurns(chat.conversation),
      });
      reply = { from: "bot", text: answer };
    } catch {
      const faq = matchFaq(question);
      reply = faq ? { from: "bot", text: faq.answer, action: faq.action } : { from: "bot", text: FALLBACK };
    }

    setChat((state) => ({ conversation: [...state.conversation, reply], typing: false }));
  };

  const goTo = (path: string) => {
    setOpen(false);
    if (window.location.pathname !== path) navigate(router, path);
  };

  // Keep the newest message (or the typing dots) in view.
  useEffect(() => {
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [conversation.length, typing, open]);

  // Android back closes the chat first (above the router's handler).
  useEffect(() => {
    if (!open) return;
    const onBack = (ev: Event) =>
      (ev as CustomEvent).detail.register(100, () => setOpen(false));
    document.addEventListener("ionBackButton", onBack);
    return () => document.removeEventListener("ionBackButton", onBack);
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="help-chat"
          role="dialog"
          aria-label="Help chat"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <header className="help-chat__header">
            <BotAvatar />
            <div className="help-chat__title">
              <strong>CineReserve Help</strong>
              <span>
                <i className="help-chat__online" aria-hidden="true" />
                Typically replies instantly
              </span>
            </div>
            <button
              type="button"
              className="help-chat__close"
              aria-label="Close help chat"
              onClick={() => setOpen(false)}
            >
              <IonIcon icon={closeOutline} />
            </button>
          </header>

          <div className="help-chat__messages" ref={listRef} aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={`help-chat__row help-chat__row--${message.from}`}>
                {message.from === "bot" && <BotAvatar />}
                <div className={`help-chat__bubble help-chat__bubble--${message.from}`}>
                  {message.text}
                  {message.action && (
                    <button
                      type="button"
                      className="help-chat__action"
                      onClick={() => goTo(message.action!.path)}
                    >
                      {message.action.label}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="help-chat__row help-chat__row--bot" aria-label="Typing">
                <BotAvatar />
                <div className="help-chat__bubble help-chat__bubble--bot help-chat__typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>

          <form
            className="help-chat__composer"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Aa"
              aria-label="Type a question"
              enterKeyHint="send"
            />
            <button type="submit" aria-label="Send" disabled={!draft.trim() || typing}>
              <IonIcon icon={sendOutline} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className={`help-chat-fab${open ? " help-chat-fab--open" : ""}`}
        aria-label={open ? "Close help chat" : "Open help chat"}
        aria-expanded={open}
        onClick={toggle}
      >
        <IonIcon icon={open ? closeOutline : chatbubbleEllipses} />
        {unread && !open && <span className="help-chat-fab__badge">1</span>}
      </button>
    </>
  );
};

export default HelpChat;
