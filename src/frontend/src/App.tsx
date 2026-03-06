import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Loader2,
  Pill,
  RotateCcw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function generateSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Render markdown-like content: **bold** patterns become <strong> elements */
function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    // Parse inline **bold** patterns
    const parts: React.ReactNode[] = [];
    const boldPattern = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: pattern is idiomatic
    while ((match = boldPattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(
        <strong
          key={`bold-${lineIdx}-${match.index}`}
          className="font-semibold text-foreground"
        >
          {match[1]}
        </strong>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    // Empty line = spacing
    if (line.trim() === "") {
      // biome-ignore lint/suspicious/noArrayIndexKey: static text lines never reorder
      return <span key={`line-${lineIdx}`} className="block h-2" />;
    }

    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: static text lines never reorder
      <span key={`line-${lineIdx}`} className="block leading-relaxed">
        {parts.length > 0 ? parts : line}
      </span>
    );
  });
}

// ── Suggestion chips ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  "What medicines treat malaria in Africa?",
  "Tell me about Artemether-Lumefantrine",
  "What are common antihypertensives in Asia?",
  "Is Metformin safe for elderly patients?",
];

const MEDICINE_CATEGORIES = [
  {
    label: "Antibiotics",
    query: "Tell me about common Antibiotics medicines worldwide",
  },
  {
    label: "Pain Relief",
    query: "Tell me about common Pain Relief medicines worldwide",
  },
  {
    label: "Heart & BP",
    query: "Tell me about common Heart & BP medicines worldwide",
  },
  {
    label: "Diabetes",
    query: "Tell me about common Diabetes medicines worldwide",
  },
  {
    label: "Mental Health",
    query: "Tell me about common Mental Health medicines worldwide",
  },
  {
    label: "Vitamins",
    query: "Tell me about common Vitamins medicines worldwide",
  },
  {
    label: "Respiratory",
    query: "Tell me about common Respiratory medicines worldwide",
  },
  {
    label: "Women's Health",
    query: "Tell me about common Women's Health medicines worldwide",
  },
  {
    label: "Pediatrics",
    query: "Tell me about common Pediatrics medicines worldwide",
  },
  {
    label: "Tropical Diseases",
    query: "Tell me about common Tropical Diseases medicines worldwide",
  },
];

// ── Typing Indicator ───────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div
      data-ocid="chat.loading_state"
      className="flex items-end gap-3 msg-animate"
    >
      <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/20 ring-offset-1">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-display font-semibold">
          Rx
        </AvatarFallback>
      </Avatar>
      <div className="assistant-bubble rounded-bubble rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="text-xs text-muted-foreground ml-1 animate-pulse">
            AI is analyzing...
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Medicine Info Card ──────────────────────────────────────────────────────
function MedicineInfoCard({ content }: { content: string }) {
  return (
    <div
      data-ocid="medicine.card"
      className="mt-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/10 p-4 shadow-xs"
    >
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-primary/15">
        <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Pill className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
          Medicine Information
        </span>
      </div>
      <div className="text-sm text-foreground leading-relaxed">
        {renderContent(content)}
      </div>
    </div>
  );
}

// ── Medicine Search ─────────────────────────────────────────────────────────
interface MedicineSearchProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  medicineInfo: string | null;
  isSearching: boolean;
  onSearch: (q: string) => void;
}

function MedicineSearch({
  searchQuery,
  setSearchQuery,
  medicineInfo,
  isSearching,
  onSearch,
}: MedicineSearchProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-2">
        Search any medicine worldwide
      </p>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            data-ocid="medicine.search_input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. Amoxicillin, Paracetamol, Chloroquine..."
            className="pl-9 bg-card border-border rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            disabled={isSearching}
            aria-label="Search medicine name"
          />
        </div>
        <Button
          data-ocid="medicine.search_button"
          type="submit"
          disabled={!searchQuery.trim() || isSearching}
          size="sm"
          className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 shrink-0 gap-1.5 disabled:opacity-40"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              Search
            </>
          )}
        </Button>
      </form>

      {isSearching && (
        <div
          data-ocid="medicine.loading_state"
          className="mt-3 flex items-center gap-2 text-xs text-muted-foreground px-1"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Searching global medicine database via Gemini AI...</span>
        </div>
      )}

      {medicineInfo && !isSearching && (
        <MedicineInfoCard content={medicineInfo} />
      )}
    </div>
  );
}

// ── Welcome Panel ───────────────────────────────────────────────────────────
interface WelcomePanelProps {
  onSuggestion: (text: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  medicineInfo: string | null;
  isSearching: boolean;
  onSearch: (q: string) => void;
}

function WelcomePanel({
  onSuggestion,
  searchQuery,
  setSearchQuery,
  medicineInfo,
  isSearching,
  onSearch,
}: WelcomePanelProps) {
  return (
    <div
      data-ocid="chat.welcome_panel"
      className="flex flex-col items-center justify-center h-full px-4 py-8"
      data-empty-state="chat.empty_state"
    >
      <div data-ocid="chat.empty_state" className="w-full max-w-lg">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl header-gradient flex items-center justify-center shadow-[0_8px_32px_0_rgba(0,80,100,0.22)] ring-4 ring-white/20">
              <span
                className="text-5xl select-none"
                role="img"
                aria-label="pharmacy"
              >
                ⚕️
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-center text-foreground mb-2">
          Welcome to SSR AI Pharmaclinic
        </h2>
        <p className="text-muted-foreground text-center text-sm sm:text-base mb-5 leading-relaxed">
          Powered by Gemini AI — covering medicines from every country in the
          world. Ask about dosages, drug interactions, side effects, and
          pharmacy advice.
        </p>

        {/* Medicine Categories */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-2">
            Browse by category
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {MEDICINE_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                data-ocid={`medicine.category.button.${i + 1}`}
                onClick={() => onSuggestion(cat.query)}
                className="
                  px-3 py-1.5 rounded-full text-xs font-medium
                  bg-primary/10 text-primary border border-primary/25
                  hover:bg-primary/20 hover:border-primary/40
                  transition-all duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
                "
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-col gap-2 mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-1">
            Try asking...
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((suggestion, i) => (
              <button
                key={suggestion}
                type="button"
                data-ocid={`chat.suggestion.button.${i + 1}`}
                onClick={() => onSuggestion(suggestion)}
                className="
                  text-left px-4 py-3 rounded-xl text-sm
                  bg-card border border-border border-l-[3px] border-l-primary/50 text-foreground
                  hover:border-l-primary hover:bg-primary/5 hover:shadow-xs
                  transition-all duration-150 shadow-xs
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                "
              >
                <Pill className="inline-block h-3.5 w-3.5 mr-2 text-primary opacity-70" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Medicine Search */}
        <MedicineSearch
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          medicineInfo={medicineInfo}
          isSearching={isSearching}
          onSearch={onSearch}
        />

        {/* Disclaimer */}
        <div className="flex gap-3 p-4 rounded-xl bg-muted border border-border mt-5">
          <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="font-semibold">Important:</strong> This service
            provides general pharmaceutical information only. Always consult a
            licensed pharmacist or healthcare provider for personal medical
            advice.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────────────────
function MessageBubble({
  message,
  index,
}: { message: Message; index: number }) {
  const isUser = message.role === "user";

  return (
    <div
      data-ocid={`chat.item.${index + 1}`}
      className={`flex items-end gap-3 msg-animate ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/20 ring-offset-1">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-display font-semibold">
            Rx
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={`flex flex-col gap-1 max-w-[75%] sm:max-w-[65%] ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`
            px-4 py-3 rounded-bubble text-sm leading-relaxed break-words
            ${
              isUser
                ? "user-bubble-gradient rounded-br-sm shadow-bubble"
                : "assistant-bubble rounded-bl-sm"
            }
          `}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            renderContent(message.content)
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
          <Clock className="h-3 w-3" />
          <span>{formatTime(message.timestamp)}</span>
        </div>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-border ring-offset-1">
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
            You
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { actor } = useActor();
  const [sessionId] = useState<string>(generateSessionId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [medicineInfo, setMedicineInfo] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional scroll trigger on messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show scroll-to-bottom button when scrolled up
  useEffect(() => {
    const el = chatAreaRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 200);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional resize trigger on inputValue
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxH = Number.parseInt(getComputedStyle(ta).lineHeight) * 3 + 32;
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
  }, [inputValue]);

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.sendMessage(sessionId, message);
    },
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: response,
          timestamp: new Date(),
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          content:
            "I'm sorry, I encountered an issue processing your request. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.clearHistory(sessionId);
    },
    onSuccess: () => {
      setMessages([]);
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      if (!actor) throw new Error("Not connected");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (
        actor as unknown as { searchMedicine: (q: string) => Promise<string> }
      ).searchMedicine(q);
    },
    onSuccess: (result) => setMedicineInfo(result),
    onError: () =>
      setMedicineInfo(
        "Could not retrieve medicine information. Please try again.",
      ),
  });

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || sendMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-user`,
        role: "user",
        content: text,
        timestamp: new Date(),
      },
    ]);
    setInputValue("");
    sendMutation.mutate(text);
  }, [inputValue, sendMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSuggestion = useCallback((text: string) => {
    setInputValue(text);
    textareaRef.current?.focus();
  }, []);

  const handleNewChat = useCallback(() => {
    clearMutation.mutate();
  }, [clearMutation]);

  const handleSearch = useCallback(
    (q: string) => {
      searchMutation.mutate(q);
    },
    [searchMutation],
  );

  const isLoading = sendMutation.isPending;
  const showWelcome = messages.length === 0 && !isLoading;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        data-ocid="header.section"
        className="header-gradient shrink-0 z-10 shadow-md"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <span className="text-xl" role="img" aria-label="caduceus">
                ⚕️
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-display font-bold text-base sm:text-lg leading-tight tracking-tight">
                  SSR AI Pharmaclinic
                </h1>
                <span
                  data-ocid="header.ai_badge"
                  className="hidden sm:inline-flex items-center gap-1 text-white/60 text-xs border border-white/20 rounded-full px-2 py-0.5"
                >
                  <Sparkles className="h-3 w-3" />
                  Powered by Gemini AI
                </span>
              </div>
              <p className="text-white/70 text-xs leading-none hidden sm:block">
                Your trusted global pharmacy counselling assistant
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                data-ocid="chat.new_button"
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                disabled={clearMutation.isPending}
                className="text-white/80 hover:text-white hover:bg-white/15 border border-white/20 text-xs h-8 px-3 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                New Chat
              </Button>
            )}
            <div className="flex items-center gap-1.5 text-white/50 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Chat Area ──────────────────────────────────────────────────────── */}
      <main
        data-ocid="chat.section"
        ref={chatAreaRef}
        className="flex-1 overflow-y-auto chat-gradient-bg relative"
        aria-label="Chat messages"
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {showWelcome ? (
            <WelcomePanel
              onSuggestion={handleSuggestion}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              medicineInfo={medicineInfo}
              isSearching={searchMutation.isPending}
              onSearch={handleSearch}
            />
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((msg, idx) => (
                <MessageBubble key={msg.id} message={msg} index={idx} />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={bottomRef} aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Scroll-to-bottom FAB */}
        {showScrollBtn && !showWelcome && (
          <button
            type="button"
            data-ocid="chat.scroll_bottom_button"
            onClick={() =>
              bottomRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            className="fixed bottom-32 right-6 z-20 w-9 h-9 rounded-full bg-primary text-white shadow-bubble flex items-center justify-center hover:bg-primary/90 transition-all"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </main>

      {/* ── Input Bar ─────────────────────────────────────────────────────── */}
      <footer className="shrink-0 bg-card/80 backdrop-blur-sm border-t border-border shadow-[0_-2px_12px_0_rgba(0,60,80,0.06)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                data-ocid="chat.input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about medicines, dosages, interactions worldwide..."
                disabled={isLoading}
                rows={1}
                className="
                  min-h-[44px] max-h-[96px] resize-none py-3 pr-3 pl-4
                  bg-card border-border rounded-xl text-sm
                  focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
                  placeholder:text-muted-foreground/70
                  disabled:opacity-60 transition-all
                  leading-relaxed
                "
                aria-label="Type your pharmacy question"
              />
              {inputValue.length > 0 && (
                <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/50">
                  {inputValue.length}
                </span>
              )}
            </div>

            <Button
              data-ocid="chat.submit_button"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              className="
                h-11 w-11 rounded-xl shrink-0
                bg-primary hover:bg-primary/90
                disabled:opacity-40 disabled:cursor-not-allowed
                shadow-bubble transition-all duration-150
                active:scale-95
              "
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </footer>
    </div>
  );
}
