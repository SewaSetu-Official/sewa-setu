"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { X, Send, Stethoscope, Loader2, MapPin, Sparkles, AlertTriangle } from "lucide-react";

type DepartmentOption = {
  id: string;
  name: string;
  slug: string;
  doctorCount: number;
};

type HospitalOption = {
  id: string;
  name: string;
  slug: string;
  type: string;
  location: string;
  minPrice: number;
  services: string[];
  specialties?: string[];
  departments?: DepartmentOption[];
  matchedDepartment?: string;
};

type MatchedDepartment = {
  department: string;
  confidence: number;
  matchedKeywords: string[];
};

type MessageMetadata = {
  action?: string;
  hospital?: HospitalOption;
  department?: DepartmentOption;
};

type BookingData = {
  patientName: string;
  patientAge: string;
  patientPhone: string;
  buyerEmail: string;
};

type StoredConversation = {
  messages?: Message[];
  bookingStep?: BookingStep;
  selectedHospital?: HospitalOption | null;
  selectedDepartment?: DepartmentOption | null;
  problemDescription?: string;
  bookingData?: BookingData;
  lastUpdated?: string;
};

type Message = {
  role: "user" | "bot";
  content: string;
  type?: "chat" | "booking_intent" | "symptoms_analyzed" | "confirmation" | "error";
  hospitals?: HospitalOption[];
  matchedDepartments?: MatchedDepartment[];
  isEmergency?: boolean;
  metadata?: MessageMetadata;
};

type BookingStep = "chat" | "symptoms" | "hospital_selection" | "confirmation";

// Storage key for conversation
const STORAGE_KEY = "sewaSetu_ai_search_history";
const EMPTY_BOOKING_DATA: BookingData = {
  patientName: "",
  patientAge: "",
  patientPhone: "",
  buyerEmail: "",
};
const INITIAL_GREETING: Message = {
  role: "bot",
  content: "Namaste! I'm your Sewa-Setu health assistant. Tell me your symptoms or health concerns, and I'll recommend the right hospital and specialist for you.",
  type: "chat",
};

function createConversationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `conv_${crypto.randomUUID()}`;
  }

  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

type Props = {
  isOpen: boolean;
  onCloseAction: () => void;
  initialConversationId?: string;
};

export function AISearchModal({ isOpen, onCloseAction, initialConversationId }: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => (initialConversationId ? [] : [INITIAL_GREETING]));
  const [isLoading, setIsLoading] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>("chat");
  const [selectedHospital, setSelectedHospital] = useState<HospitalOption | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentOption | null>(null);
  const [problemDescription, setProblemDescription] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string>(initialConversationId || "");

  const [bookingData, setBookingData] = useState<BookingData>(EMPTY_BOOKING_DATA);

  const scrollRef = useRef<HTMLDivElement>(null);

  const ensureConversationId = () => {
    if (currentConversationId) return currentConversationId;
    const newId = createConversationId();
    setCurrentConversationId(newId);
    return newId;
  };

  // Load saved conversation
  const loadConversation = (convId: string) => {
    try {
      console.log("[AISearchModal] Loading conversation:", convId);
      const saved = localStorage.getItem(`${STORAGE_KEY}_${convId}`);
      if (saved) {
        const conversation = JSON.parse(saved) as StoredConversation;
        console.log("[AISearchModal] Loaded conversation data:", conversation);
        setMessages(conversation.messages || []);
        setBookingStep(conversation.bookingStep || "chat");
        setSelectedHospital(conversation.selectedHospital || null);
        setSelectedDepartment(conversation.selectedDepartment || null);
        setProblemDescription(conversation.problemDescription || "");
        setBookingData(conversation.bookingData || EMPTY_BOOKING_DATA);
        setCurrentConversationId(convId);
      } else {
        console.log("[AISearchModal] No saved conversation found for ID:", convId);
        setCurrentConversationId(convId);
      }
    } catch (error) {
      console.error("[AISearchModal] Failed to load conversation:", error);
    }
  };

  // Load conversation if initialConversationId is provided
  useEffect(() => {
    if (!initialConversationId) return;
    const timeoutId = window.setTimeout(() => {
      loadConversation(initialConversationId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialConversationId]);

  // Auto-save when state changes
  useEffect(() => {
    if (!currentConversationId || messages.length === 0) return;

    try {
      const conversation: StoredConversation = {
        messages,
        bookingStep,
        selectedHospital,
        selectedDepartment,
        problemDescription,
        bookingData,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(`${STORAGE_KEY}_${currentConversationId}`, JSON.stringify(conversation));
    } catch (error) {
      console.error("[AISearchModal] Failed to save conversation:", error);
    }
  }, [messages, bookingStep, selectedHospital, selectedDepartment, problemDescription, bookingData, currentConversationId]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, bookingStep]);

  // Initialize a fresh conversation when the modal opens without a saved history
  useEffect(() => {
    if (!isOpen || messages.length > 0 || currentConversationId) return;
    const timeoutId = window.setTimeout(() => {
      const newId = createConversationId();
      setCurrentConversationId(newId);
      setMessages([
        {
          role: "bot",
          content: "Namaste! 🙏 I'm your Sewa-Setu health assistant. Tell me your symptoms or health concerns, and I'll recommend the right hospital and specialist for you.",
          type: "chat",
        },
      ]);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, messages.length, currentConversationId]);

  const askAI = async () => {
    if (!prompt.trim()) return;

    const userMsg = prompt;
    const activeConversationId = ensureConversationId();
    setPrompt("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMsg,
          action: "chat",
          conversationId: activeConversationId,
        }),
      });

      const data = await res.json();

      if (data.conversationId && !currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }

      if (data.type === "booking_intent" && data.nextStep === "collect_symptoms") {
        setBookingStep("symptoms");
        setMessages((prev) => [
          ...prev,
          { role: "bot", content: data.text, type: "booking_intent" },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "bot", content: data.text, type: "chat" }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "Connection error. Please try again.", type: "error" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeSymptoms = async () => {
    if (!problemDescription.trim()) return;

    const userMsg = problemDescription;
    const activeConversationId = ensureConversationId();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMsg,
          action: "analyze_symptoms",
          conversationId: activeConversationId,
        }),
      });

      const data = await res.json();
      setProblemDescription("");

      if (data.type === "symptoms_analyzed") {
        setBookingStep("hospital_selection");
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            content: data.text,
            type: "symptoms_analyzed",
            hospitals: data.hospitals,
            matchedDepartments: data.matchedDepartments,
            isEmergency: data.isEmergency,
          },
        ]);

        // If emergency, show warning
        if (data.isEmergency) {
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              content: "⚠️ **URGENT**: Based on your symptoms, please seek immediate medical attention or call emergency services (102) if you're experiencing a medical emergency.",
              type: "chat",
            },
          ]);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "Failed to analyze symptoms. Please try again.", type: "error" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectHospital = (hospital: HospitalOption) => {
    console.log("[AISearchModal] Selecting hospital:", hospital.name);
    
    if (hospital.departments && hospital.departments.length > 0) {
      setSelectedHospital(hospital);

      const deptList = hospital.departments.map((d: DepartmentOption) =>
        `• ${d.name} (${d.doctorCount} doctors)`
      ).join('\n');

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content: `Please select a department at ${hospital.name}:\n\n${deptList}`,
          type: "chat",
        },
      ]);

      hospital.departments.forEach((dept: DepartmentOption) => {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              content: dept.name,
              type: "chat",
              metadata: { action: "select_department", hospital, department: dept },
            },
          ]);
        }, 100);
      });
    } else {
      navigateToHospital(hospital, null);
    }
  };

  const selectDepartment = (hospital: HospitalOption, department: DepartmentOption) => {
    setSelectedDepartment(department);
    navigateToHospital(hospital, department);
  };

  const navigateToHospital = (hospital: HospitalOption, department: DepartmentOption | null) => {
    let url = `/hospital/${hospital.slug}`;
    const params = new URLSearchParams();
    const activeConversationId = ensureConversationId();

    if (department) {
      params.set("department", department.id);
      params.set("deptName", department.name);
    }
    
    // Add matched specialties as search params for filtering
    if (hospital.specialties && hospital.specialties.length > 0) {
      params.set("specialties", hospital.specialties.slice(0, 3).join(","));
    }
    
    // Add flag and conversation ID to indicate this navigation came from AI
    params.set("from", "ai");
    params.set("conversationId", activeConversationId);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Save one last time before navigation
    if (messages.length > 0) {
      const conversation: StoredConversation = {
        messages,
        bookingStep,
        selectedHospital,
        selectedDepartment,
        problemDescription,
        bookingData,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(`${STORAGE_KEY}_${activeConversationId}`, JSON.stringify(conversation));
    }

    onCloseAction();
    router.push(url);
  };

  // Handle custom message actions
  const handleMessageClick = (msg: Message) => {
    if (msg.metadata?.action === "select_department" && msg.metadata.hospital && msg.metadata.department) {
      selectDepartment(msg.metadata.hospital, msg.metadata.department);
    }
  };

  // Quick action to search for doctors/hospitals
  const startDoctorSearch = () => {
    ensureConversationId();
    setBookingStep("symptoms");
    setMessages((prev) => [
      ...prev,
      {
        role: "bot",
        content: "Great! Please describe your symptoms or health concerns in detail so I can find the right doctors and hospitals for you.",
        type: "booking_intent",
      },
    ]);
  };

  // Clear conversation and start new
  const handleNewChat = () => {
    const newId = createConversationId();
    setCurrentConversationId(newId);
    setMessages([INITIAL_GREETING]);
    setBookingStep("chat");
    setSelectedHospital(null);
    setSelectedDepartment(null);
    setProblemDescription("");
    setBookingData(EMPTY_BOOKING_DATA);
    
    // Add initial greeting
    setMessages([
      {
        role: "bot",
        content: "Namaste! 🙏 I'm your Sewa-Setu health assistant. Tell me your symptoms or health concerns, and I'll recommend the right hospital and specialist for you.",
        type: "chat",
      },
    ]);
  };

  if (!isOpen || typeof document === "undefined") return null;

  const QUICK_PROMPTS = [
    "Chest tightness when I climb stairs",
    "Persistent headache for 3 days",
    "Need a full-body checkup",
  ];

  const modalContent = (
    <>
      {/* backdrop */}
      <div
        onClick={onCloseAction}
        style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(20,33,29,.4)", backdropFilter: "blur(2px)" }}
      />

      {/* drawer */}
      <aside
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 61,
          width: 400, maxWidth: "100vw", background: "#14211D",
          boxShadow: "-30px 0 70px -30px rgba(0,0,0,.7)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "relative", padding: "20px 20px 16px",
            background: "radial-gradient(circle at 90% 0%,rgba(12,107,87,.55),transparent 60%)",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
          }}
        >
          <span style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#E0913A,#cf7f29)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={22} color="#fff" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-bricolage), sans-serif", fontWeight: 700, fontSize: "17px", color: "#fff", display: "flex", alignItems: "center", gap: 7 }}>
              Smart Search
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#9FE3CD", background: "rgba(12,107,87,.45)", padding: "2px 7px", borderRadius: 99 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: "#3FD08C" }} />AI
              </span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#9FB0AA" }}>Describe symptoms, get matched</div>
          </div>
          {messages.length > 1 && (
            <button
              onClick={handleNewChat}
              title="New chat"
              style={{ border: "none", cursor: "pointer", height: 34, padding: "0 10px", borderRadius: 9, background: "rgba(255,255,255,.08)", color: "#C7D2CD", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, flexShrink: 0 }}
            >
              <Sparkles size={13} /> New
            </button>
          )}
          <button
            onClick={onCloseAction}
            aria-label="Close"
            style={{ border: "none", cursor: "pointer", width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <X size={17} color="#C7D2CD" />
          </button>
        </div>

        {/* Chat Area */}
        <div
          ref={scrollRef}
          className="thin-scrollbar"
          style={{ flex: 1, padding: 18, display: "flex", flexDirection: "column", gap: 13, overflowY: "auto" }}
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                {/* Emergency message */}
                {msg.isEmergency && (
                  <div style={{ alignSelf: "flex-start", maxWidth: "92%", background: "rgba(192,85,107,.16)", border: "1.5px solid rgba(192,85,107,.5)", color: "#F3C3CD", padding: "12px 14px", borderRadius: "15px 15px 15px 4px", fontSize: "13.5px", lineHeight: 1.5, fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <AlertTriangle size={16} /><span>EMERGENCY</span>
                    </div>
                    {msg.content}
                  </div>
                )}

                {/* Regular chat message */}
                {!msg.isEmergency && msg.metadata?.action !== "select_department" && (
                  <div
                    onClick={() => handleMessageClick(msg)}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: isUser ? "84%" : "92%",
                      background: isUser ? "#0C6B57" : "rgba(255,255,255,.07)",
                      color: isUser ? "#fff" : "#E3EAE7",
                      padding: "11px 14px",
                      borderRadius: isUser ? "15px 15px 4px 15px" : "15px 15px 15px 4px",
                      fontSize: "13.5px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      cursor: msg.metadata ? "pointer" : "default",
                    }}
                  >
                    {msg.content}
                  </div>
                )}

                {/* Hospital cards - display when type is symptoms_analyzed */}
                {msg.type === "symptoms_analyzed" && msg.hospitals && msg.hospitals.length > 0 && (
                  <div style={{ marginTop: 4, width: "100%" }}>
                    <p style={{ fontSize: "11.5px", color: "#9FB0AA", marginBottom: 8, fontWeight: 600 }}>Recommended providers:</p>
                    {msg.hospitals.map((hospital) => (
                      <div
                        key={hospital.id}
                        onClick={() => selectHospital(hospital)}
                        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: 12, marginBottom: 8, cursor: "pointer", transition: "all .2s ease" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(159,227,205,.4)"; e.currentTarget.style.background = "rgba(255,255,255,.09)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,.12)"; e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
                      >
                        <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#fff", marginBottom: 4 }}>{hospital.name}</div>
                        <div style={{ fontSize: "11.5px", color: "#9FB0AA", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                          <MapPin size={12} />{hospital.location}
                        </div>
                        {hospital.matchedDepartment && (
                          <span style={{ fontSize: "11px", padding: "3px 8px", background: "rgba(224,145,58,.18)", color: "#EBB36B", borderRadius: 6, display: "inline-block", fontWeight: 600 }}>
                            ✓ Matched: {hospital.matchedDepartment}
                          </span>
                        )}
                        {hospital.specialties && hospital.specialties.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "8px 0 0" }}>
                            {hospital.specialties.slice(0, 3).map((s, i) => (
                              <span key={i} style={{ fontSize: "10.5px", padding: "2px 8px", background: "rgba(12,107,87,.3)", color: "#CFE0D8", borderRadius: 12, border: "1px solid rgba(159,227,205,.2)" }}>{s}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: "11px", color: "#9FE3CD", marginTop: 8, textAlign: "right", fontWeight: 600 }}>
                          View {hospital.departments?.length ? "departments" : "doctors"} →
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Department button */}
                {msg.metadata?.action === "select_department" && msg.metadata.hospital && msg.metadata.department && (
                  <button
                    onClick={() => selectDepartment(msg.metadata!.hospital!, msg.metadata!.department!)}
                    style={{ alignSelf: "flex-start", background: "#0C6B57", color: "#fff", padding: "9px 14px", borderRadius: 10, border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {msg.content} →
                  </button>
                )}
              </div>
            );
          })}

          {/* Welcome prompt chips — only on the fresh greeting */}
          {bookingStep === "chat" && messages.length <= 1 && !isLoading && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 2 }}>
              {QUICK_PROMPTS.map((label) => (
                <button
                  key={label}
                  onClick={() => { setPrompt(label); setTimeout(() => askAI(), 0); }}
                  style={{ cursor: "pointer", fontSize: "11.5px", fontWeight: 600, color: "#CFE0D8", background: "rgba(12,107,87,.3)", border: "1px solid rgba(159,227,205,.2)", padding: "6px 11px", borderRadius: 99 }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Quick action button for finding hospitals */}
          {bookingStep === "chat" && messages.length > 1 && !isLoading && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
              <button
                onClick={startDoctorSearch}
                style={{ padding: "9px 18px", background: "linear-gradient(135deg,#E0913A,#cf7f29)", color: "#fff", border: "none", borderRadius: 10, fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
              >
                Find hospitals &amp; doctors
              </button>
            </div>
          )}

          {/* Typing indicator */}
          {isLoading && (
            <div style={{ alignSelf: "flex-start", display: "flex", gap: 4, background: "rgba(255,255,255,.07)", padding: "12px 15px", borderRadius: "15px 15px 15px 4px" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: "#9FB0AA", animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{ padding: "14px 16px 16px", borderTop: "1px solid rgba(255,255,255,.08)", flexShrink: 0 }}>
          {bookingStep === "chat" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 12, padding: "5px 5px 5px 14px" }}>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAI()}
                placeholder="Describe how you feel…"
                style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", outline: "none", fontSize: "13.5px", color: "#fff", fontFamily: "inherit" }}
              />
              <button
                onClick={askAI}
                disabled={isLoading || !prompt.trim()}
                title="Send"
                style={{ border: "none", cursor: isLoading || !prompt.trim() ? "not-allowed" : "pointer", width: 34, height: 34, borderRadius: 9, background: isLoading || !prompt.trim() ? "rgba(12,107,87,.4)" : "#0C6B57", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <Send size={16} color="#fff" />
              </button>
            </div>
          ) : bookingStep === "symptoms" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Describe your symptoms in detail…"
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 12, padding: "11px 14px", fontSize: "13.5px", color: "#fff", outline: "none", resize: "none", minHeight: 64, maxHeight: 110, fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setBookingStep("chat"); setProblemDescription(""); }}
                  style={{ height: 40, padding: "0 16px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 10, color: "#C7D2CD", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                >
                  Back
                </button>
                <button
                  onClick={analyzeSymptoms}
                  disabled={isLoading || !problemDescription.trim()}
                  style={{ flex: 1, height: 40, background: isLoading || !problemDescription.trim() ? "rgba(12,107,87,.4)" : "#0C6B57", border: "none", borderRadius: 10, color: "#fff", cursor: isLoading || !problemDescription.trim() ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Analyze symptoms"}
                </button>
              </div>
            </div>
          ) : bookingStep === "hospital_selection" ? (
            <div style={{ fontSize: "12.5px", color: "#9FB0AA", textAlign: "center", padding: 6 }}>
              Select a provider above, or{" "}
              <button onClick={() => setBookingStep("symptoms")} style={{ background: "none", border: "none", color: "#9FE3CD", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}>
                describe more symptoms
              </button>
            </div>
          ) : null}
          <div style={{ fontSize: "10.5px", color: "#6E7E78", textAlign: "center", marginTop: 9 }}>
            AI guidance, not a medical diagnosis. For emergencies call 102.
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes pulse {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  );

  return createPortal(modalContent, document.body);
}
