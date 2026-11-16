import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Home,
  Film,
  Users,
  Radio,
  BarChart3,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Command,
  Scissors,
  Sparkles,
  Play,
  Link,
  Upload,
  X,
  Check,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  SlidersHorizontal,
  LoaderCircle,
  MonitorPlay,
  Smartphone,
  Captions,
  ExternalLink,
  Code2,
  HelpCircle,
  LogOut,
  Volume2,
  Download,
  CircleAlert,
  Menu,
  Pause,
  Eye,
  Cloud,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import AnimatedContent from "./components/reactbits/AnimatedContent";
import SpotlightCard from "./components/reactbits/SpotlightCard";
import CountUp from "./components/reactbits/CountUp";
import {
  api,
  send,
  upload,
  engineUrl,
  fullStudioUrl,
  localEngineRoute,
  downloadClip,
  getEngineToken,
  setEngineToken,
  pairingOrigin,
  fetchClip,
} from "./api";

const nav = [
  { id: "home", label: "Overview", icon: Home },
  { id: "videos", label: "My videos", icon: Film },
  { id: "creators", label: "Creators", icon: Users },
  { id: "live", label: "Live streams", icon: Radio },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];
const defaults = {
  max_clips: 6,
  min_len: 15,
  max_len: 60,
  style: "bounce",
  layout: "blur",
  quality: 720,
};
const stages = [
  "queued",
  "running",
  "live",
  "downloading",
  "transcribing",
  "analyzing",
  "rendering",
];
const doneClips = (jobs) =>
  jobs.flatMap((j) =>
    (j.clips || [])
      .filter((c) => c.status === "done")
      .map((c) => ({ ...c, job: j })),
  );
const duration = (n) =>
  `${Math.floor(Number(n || 0) / 60)}:${String(Math.round(Number(n || 0) % 60)).padStart(2, "0")}`;

function Button({ children, className = "", variant = "", ...props }) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
function Logo({ small = false }) {
  return (
    <div className="logo">
      <img src="/favicon.svg" alt="" />
      <span>
        peakcut<span className="logo-dot">.</span>
      </span>
      {!small && <sup>STUDIO</sup>}
    </div>
  );
}
function Pill({ children, tone = "" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
function Empty({ icon: Icon = Film, title, description, action }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={`empty fade-in mui-enter ${entered ? "mui-enter-active" : ""}`}
    >
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const last = document.activeElement;
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const elements = [
          ...ref.current.querySelectorAll(
            'button,input,select,a,textarea,[tabindex="0"]',
          ),
        ].filter((x) => !x.disabled);
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = scroll;
      document.removeEventListener("keydown", key);
      last?.focus();
    };
  }, []);
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        initial={{ y: 20, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 10, opacity: 0 }}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">PEAKCUT STUDIO</span>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </motion.section>
    </motion.div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [status, setStatus] = useState(null);
  const [data, setData] = useState({ jobs: [], creators: [], accounts: [] });
  const [overview, setOverview] = useState(null);
  const [connection, setConnection] = useState("loading");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState("");
  const reduced = useReducedMotion();
  const searchRef = useRef(null);
  const notify = useCallback((msg) => setToast(msg), []);
  const refresh = useCallback(async () => {
    try {
      const s = await api("/status");
      setStatus(s);
      const [sync, ov] = await Promise.all([api("/sync"), api("/overview")]);
      setData(sync);
      setOverview(ov);
      setConnection("online");
    } catch (e) {
      setConnection(
        e.status === 428 || (import.meta.env.PROD && e.status === 401)
          ? "pair"
          : e.status === 401
            ? "signin"
            : "offline",
      );
    }
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 6000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);
  useEffect(() => {
    const listener = (event) => {
      if (
        event.origin !== pairingOrigin ||
        event.source !== window.opener ||
        event.data?.type !== "peakcut-engine-pair"
      )
        return;
      try {
        setEngineToken(event.data.token);
        window.history.replaceState(null, "", "/");
        refresh();
        notify(
          "This browser is connected to your computer. Your videos stay local.",
        );
      } catch {
        notify(
          "The pairing key was not valid. Open the local engine and try again.",
        );
      }
    };
    const storage = (event) => {
      if (event.key === "peakcut-engine-pair-v1") refresh();
    };
    window.addEventListener("message", listener);
    window.addEventListener("storage", storage);
    if (
      new URLSearchParams(window.location.search).has("connect-local") &&
      window.opener
    )
      window.opener.postMessage(
        { type: "peakcut-studio-ready" },
        pairingOrigin,
      );
    return () => {
      window.removeEventListener("message", listener);
      window.removeEventListener("storage", storage);
    };
  }, [refresh, notify]);
  const changeView = (id) => {
    setView(id);
    setQuery("");
    setMobile(false);
    setCreatorFilter("");
  };
  const clips = useMemo(() => doneClips(data.jobs || []), [data.jobs]);
  const processing = (data.jobs || []).filter((j) => stages.includes(j.status));
  const openProject = () => {
    setModal({ type: connection === "signin" ? "auth" : "project" });
  };
  const pickCreator = (c) => {
    setCreatorFilter(c.id);
    setView("videos");
  };
  const stats = [
    {
      label: "Clips created",
      value: clips.length,
      icon: Scissors,
      note: "Ready for their close-up",
      tone: "coral",
    },
    {
      label: "Videos processed",
      value: (data.jobs || []).filter((j) => j.status === "done").length,
      icon: Film,
      note: processing.length
        ? `${processing.length} in progress`
        : "Long-form, meet short-form",
      tone: "lilac",
    },
    {
      label: "Connected creators",
      value: data.creators?.length || 0,
      icon: Users,
      note: "Your creative universe",
      tone: "green",
    },
    {
      label: "Clips published",
      value: overview?.creators?.reduce((a, c) => a + c.posted_total, 0) || 0,
      icon: ArrowUpRight,
      note: "Out there making an impact",
      tone: "sand",
    },
  ];
  const greeting =
    new Date().getHours() < 12
      ? "Good morning"
      : new Date().getHours() < 18
        ? "Good afternoon"
        : "Good evening";
  return (
    <div className={`app-shell ${mobile ? "menu-open" : ""}`}>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close menu"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="sidebar">
        <Logo />
        <button
          className="workspace-switch"
          onClick={() => changeView("creators")}
        >
          <span className="workspace-avatar">P</span>
          <span>
            <strong>My workspace</strong>
            <small>Your creative corner</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? "active" : ""}`}
              onClick={() => changeView(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "videos" && !!data.jobs?.length && (
                <span className="nav-count">{data.jobs.length}</span>
              )}
              {n.id === "live" && <span className="live-dot" />}
            </button>
          ))}
        </nav>
        <div className="creators-label">
          <span className="nav-label">YOUR CREATORS</span>
          <button
            aria-label="Add creator"
            onClick={() => setModal({ type: "creator" })}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="side-creators">
          {data.creators?.length ? (
            data.creators.slice(0, 4).map((c) => (
              <button key={c.id} onClick={() => pickCreator(c)}>
                <span className="creator-avatar">
                  {c.name?.slice(0, 1).toUpperCase()}
                </span>
                {c.name}
                <ChevronRight size={14} />
              </button>
            ))
          ) : (
            <button
              className="add-creator"
              onClick={() => setModal({ type: "creator" })}
            >
              <span className="dashed-avatar">
                <Plus size={14} />
              </span>
              Add your first creator
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="side-note">
            <span className="note-spark">
              <Sparkles size={18} />
            </span>
            <h4>Big moments. Small clips.</h4>
            <p>
              Let AI find the good stuff.
              <br />
              You focus on creating.
            </p>
            <button
              onClick={() => {
                setView("settings");
                setModal(null);
              }}
            >
              Set up your AI <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => changeView("settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <button
            className="nav-item"
            onClick={() => setModal({ type: "help" })}
          >
            <HelpCircle size={18} />
            Help & getting started
            <ArrowUpRight size={14} />
          </button>
          <div className="user-row">
            <span className="user-avatar">
              {status?.user?.name?.slice(0, 1) || "Y"}
            </span>
            <div>
              <strong>{status?.user?.name || "Your workspace"}</strong>
              <small>
                {connection === "online"
                  ? "Connected to PeakCut"
                  : "PeakCut Studio"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Account settings"
              onClick={() => changeView("settings")}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {nav.find((n) => n.id === view)?.label || "Settings"}
            </strong>
          </div>
          <div className="topbar-right">
            <label className="search">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search videos"
                placeholder="Search anything..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value) setView("videos");
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              aria-expanded={notifications}
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={19} />
              {processing.length > 0 && <i />}
            </button>
            <span className="top-divider" />
            <span className="user-avatar small">
              {status?.user?.name?.slice(0, 1) || "Y"}
            </span>
          </div>
          {notifications && (
            <div className="notifications">
              <strong>You're all caught up</strong>
              <p>
                {processing.length
                  ? `${processing.length} video${processing.length > 1 ? "s are" : " is"} being processed. Check My videos for progress.`
                  : "Your video updates will appear here."}
              </p>
            </div>
          )}
        </header>
        <main id="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={reduced ? false : { opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? {} : { opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {connection === "pair" && (
                <div className="connection-banner">
                  <MonitorPlay size={16} />
                  <span>
                    Connect this browser to your computer. Your videos stay
                    local.
                  </span>
                  <a
                    className="text-button"
                    href={pairingOrigin}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Connect engine <ArrowUpRight size={13} />
                  </a>
                </div>
              )}
              {connection === "offline" && (
                <div className="connection-banner">
                  <Cloud size={16} />
                  <span>
                    The video server isn’t connected yet. Your studio is ready
                    when it is.
                  </span>
                  <button onClick={refresh}>
                    Retry <RefreshCw size={13} />
                  </button>
                </div>
              )}
              {connection === "signin" && (
                <div className="connection-banner">
                  <Users size={16} />
                  <span>Sign in to access your videos and creators.</span>
                  <button onClick={() => setModal({ type: "auth" })}>
                    Sign in <ArrowRight size={13} />
                  </button>
                </div>
              )}
              {status?.disk_full && (
                <div className="connection-banner" role="alert">
                  <Cloud size={16} />
                  <span>
                    This computer needs more free space before it can accept
                    videos.
                  </span>
                  <button onClick={() => changeView("settings")}>
                    Storage <ArrowRight size={13} />
                  </button>
                </div>
              )}
              {view === "home" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="greeting">
                        <span className="sun-icon">✳</span> {greeting}, creator
                      </div>
                      <h1>
                        A little less editing.
                        <br className="mobile-break" /> A lot more creating
                        <span className="coral-text">.</span>
                      </h1>
                      <p>Your best moments deserve more than one watch.</p>
                    </div>
                    <Button onClick={openProject}>
                      <Plus size={17} />
                      New project
                    </Button>
                  </div>
                  <AnimatedContent distance={20} duration={0.6} trigger="mount">
                    <section className="hero">
                      <div className="hero-content">
                        <span className="hero-tag">
                          <Sparkles size={13} /> YOUR CONTENT. A CUT ABOVE.
                        </span>
                        <h2>
                          Long videos.
                          <br />
                          <span>Short-form magic.</span>
                        </h2>
                        <p>
                          Turn your videos and live streams into scroll-stopping
                          <br className="desktop-break" /> clips. AI finds the
                          moments. You make them yours.
                        </p>
                        <div className="hero-actions">
                          <Button variant="dark" onClick={openProject}>
                            <Scissors size={16} />
                            Create your first clip
                            <ArrowUpRight size={16} />
                          </Button>
                          <button
                            className="text-button"
                            onClick={() => setModal({ type: "help" })}
                          >
                            <span className="round-play">
                              <Play size={10} fill="currentColor" />
                            </span>
                            See how it works
                          </button>
                        </div>
                        <div className="hero-support">
                          <span>MADE FOR</span>
                          <b>▷ YouTube</b>
                          <b>♧ Twitch</b>
                          <b>ᴋ Kick</b>
                          <span className="support-plus">
                            + your own videos
                          </span>
                        </div>
                      </div>
                      <div
                        className="hero-art"
                        aria-label="Illustration of a vertical video with animated captions"
                      >
                        <div className="orbit orbit-one" />
                        <div className="orbit orbit-two" />
                        <div className="art-spark spark-one">✳</div>
                        <div className="art-spark spark-two">✦</div>
                        <div className="floating-chip chip-top">
                          <Sparkles size={13} />
                          <span>AI finds the good stuff</span>
                        </div>
                        <div className="video-frame">
                          <div className="frame-top">
                            <span className="live-dot" />
                            PEAK MOMENT <span>9:16</span>
                          </div>
                          <div className="abstract-landscape">
                            <div className="land-sun" />
                            <div className="hill hill-back" />
                            <div className="hill hill-front" />
                            <div className="land-grain" />
                          </div>
                          <div className="frame-center">
                            <Play size={22} fill="currentColor" />
                          </div>
                          <div className="preview-caption">
                            <span>MAKE EVERY</span>
                            <strong>
                              MOMENT <em>COUNT.</em>
                            </strong>
                          </div>
                          <div className="video-progress">
                            <span />
                            <span />
                          </div>
                          <div className="frame-bottom">
                            <Volume2 size={12} />
                            <span>00:14 / 00:32</span>
                            <Smartphone size={12} />
                          </div>
                        </div>
                        <div className="floating-chip chip-bottom">
                          <span className="chip-check">
                            <Check size={12} />
                          </span>
                          <span>Captioned. Cropped. Ready.</span>
                        </div>
                        <div className="aspect-label">
                          LESS TIMELINE. MORE SPOTLIGHT.
                        </div>
                      </div>
                    </section>
                  </AnimatedContent>
                  <div className="stats-grid">
                    {stats.map((s, i) => (
                      <AnimatedContent
                        key={s.label}
                        distance={12}
                        duration={0.45}
                        delay={0.08 * i}
                        trigger="mount"
                      >
                        <SpotlightCard
                          theme="light"
                          spotlightColor="rgba(238,113,88,0.15)"
                          className="stat-card"
                        >
                          <div className="stat-top">
                            <span>{s.label}</span>
                            <span className={`stat-icon ${s.tone}`}>
                              <s.icon size={17} />
                            </span>
                          </div>
                          <div className="stat-value">
                            <CountUp
                              to={s.value}
                              duration={0.9}
                              separator=","
                            />
                          </div>
                          <span className="stat-note">{s.note}</span>
                        </SpotlightCard>
                      </AnimatedContent>
                    ))}
                  </div>
                  <section className="section">
                    <div className="section-heading">
                      <div>
                        <h2>
                          Recent projects{" "}
                          <span className="number-badge">
                            {data.jobs?.length || 0}
                          </span>
                        </h2>
                        <p>Your next big thing is a clip away.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => changeView("videos")}
                      >
                        View all projects
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {data.jobs?.length ? (
                      <ProjectList
                        jobs={data.jobs.slice(0, 3)}
                        onOpen={(job) => setModal({ type: "job", job })}
                      />
                    ) : (
                      <div className="project-empty">
                        <div className="empty-film">
                          <Film size={24} />
                          <span>
                            <Plus size={10} />
                          </span>
                        </div>
                        <div>
                          <h3>Your story starts here</h3>
                          <p>
                            Add a video and let’s find the moments worth
                            sharing.
                          </p>
                        </div>
                        <Button variant="outline" onClick={openProject}>
                          <Plus size={15} />
                          Add a video
                        </Button>
                      </div>
                    )}
                  </section>
                  <div className="bottom-grid">
                    <section className="getting-started">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">
                            FROM LONG-FORM TO CAN’T-SCROLL-PAST
                          </span>
                          <h2>Three steps. Endless possibilities.</h2>
                        </div>
                        <span className="small-spark">✳</span>
                      </div>
                      <div className="steps">
                        {[
                          {
                            n: "01",
                            icon: Link,
                            title: "Drop it in",
                            text: "Paste a link or upload a video.",
                            action: openProject,
                          },
                          {
                            n: "02",
                            icon: Sparkles,
                            title: "Find your moments",
                            text: "AI spots what’s worth sharing.",
                            action: () => changeView("settings"),
                          },
                          {
                            n: "03",
                            icon: ArrowUpRight,
                            title: "Make some noise",
                            text: "Caption, export, and share.",
                            action: () => changeView("videos"),
                          },
                        ].map((s) => (
                          <button className="step" onClick={s.action} key={s.n}>
                            <div className="step-top">
                              <s.icon size={18} />
                              <span>{s.n}</span>
                            </div>
                            <h3>{s.title}</h3>
                            <p>{s.text}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="creator-prompt">
                      <div>
                        <span className="eyebrow">BETTER TOGETHER</span>
                        <h3>A home for every creator.</h3>
                        <p>
                          Keep channels, clips, and settings
                          <br />
                          together in their own little world.
                        </p>
                        <button
                          className="text-button"
                          onClick={() => setModal({ type: "creator" })}
                        >
                          Add a creator <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <div className="avatar-art">
                        <span>✳</span>
                        <span>↗</span>
                        <span>☺</span>
                      </div>
                    </section>
                  </div>
                </>
              )}
              {view === "videos" && (
                <>
                  <PageHeading
                    eyebrow="YOUR CONTENT LIBRARY"
                    title={
                      creatorFilter
                        ? `${data.creators.find((c) => c.id === creatorFilter)?.name || "Creator"}’s videos`
                        : "Every video. All the possibilities."
                    }
                    description="A home for your source videos and their best moments."
                    action={
                      <Button onClick={openProject}>
                        <Plus size={17} />
                        New project
                      </Button>
                    }
                  />
                  <Library
                    jobs={(data.jobs || []).filter(
                      (j) => !creatorFilter || j.creator === creatorFilter,
                    )}
                    query={query}
                    onOpen={(job) => setModal({ type: "job", job })}
                    onNew={openProject}
                  />
                </>
              )}
              {view === "creators" && (
                <>
                  <PageHeading
                    eyebrow="YOUR CREATIVE UNIVERSE"
                    title="Great creators. One workspace."
                    description="Give every channel its own home, settings, and clipping style."
                    action={
                      <Button onClick={() => setModal({ type: "creator" })}>
                        <Plus size={17} />
                        Add creator
                      </Button>
                    }
                  />
                  {data.creators?.length ? (
                    <div className="creator-grid">
                      {data.creators.map((c) => (
                        <SpotlightCard
                          key={c.id}
                          theme="light"
                          className="creator-card"
                        >
                          <span className="creator-avatar large">
                            {c.name?.slice(0, 1)}
                          </span>
                          <Pill tone={c.live_job ? "green" : ""}>
                            {c.live_job ? "Recording" : "Ready to create"}
                          </Pill>
                          <h2>{c.name}</h2>
                          <p>{c.channel || "No channel connected yet"}</p>
                          <div className="creator-meta">
                            <span>
                              {
                                (data.jobs || []).filter(
                                  (j) => j.creator === c.id,
                                ).length
                              }{" "}
                              videos
                            </span>
                            <span>{c.style} captions</span>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => pickCreator(c)}
                          >
                            Open workspace
                            <ArrowUpRight size={15} />
                          </Button>
                        </SpotlightCard>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={Users}
                      title="Give your creators a place to shine"
                      description="Add a creator to organize their videos, connect channels, and set their signature style."
                      action={
                        <Button onClick={() => setModal({ type: "creator" })}>
                          <Plus size={16} />
                          Add your first creator
                        </Button>
                      }
                    />
                  )}
                </>
              )}
              {view === "live" && (
                <>
                  <PageHeading
                    eyebrow="NEVER MISS A PEAK MOMENT"
                    title="Live now. Clipped in the moment."
                    description="Record a creator’s stream and catch the highlights while they happen."
                  />
                  <div className="panel">
                    {data.creators?.filter((c) => c.channel).length ? (
                      data.creators
                        .filter((c) => c.channel)
                        .map((c) => (
                          <div className="live-row" key={c.id}>
                            <span className="creator-avatar">
                              {c.name?.slice(0, 1)}
                            </span>
                            <div>
                              <strong>{c.name}</strong>
                              <p>{c.channel}</p>
                            </div>
                            <Pill tone={c.live_job ? "green" : ""}>
                              {c.live_job ? "Recording" : "Not recording"}
                            </Pill>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await send(
                                    c.live_job
                                      ? `/live/${c.live_job}/stop`
                                      : `/creators/${c.id}/live`,
                                    {},
                                  );
                                  refresh();
                                  notify(
                                    c.live_job
                                      ? "Recording stopped"
                                      : "Recording requested",
                                  );
                                } catch (e) {
                                  notify(e.message);
                                }
                              }}
                            >
                              {c.live_job ? (
                                <Pause size={15} />
                              ) : (
                                <Radio size={15} />
                              )}
                              {c.live_job ? "Stop" : "Start recording"}
                            </Button>
                          </div>
                        ))
                    ) : (
                      <Empty
                        icon={Radio}
                        title="Your live highlights start here"
                        description="Add a creator with a Twitch, YouTube, or Kick channel to start recording streams."
                        action={
                          <Button onClick={() => setModal({ type: "creator" })}>
                            Add a live creator
                            <ArrowUpRight size={16} />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </>
              )}
              {view === "analytics" && (
                <>
                  <PageHeading
                    eyebrow="A LITTLE PERSPECTIVE"
                    title="See your creativity add up."
                    description="Real activity from your workspace, one moment at a time."
                  />
                  <div className="stats-grid">
                    {stats.map((s) => (
                      <div className="stat-card" key={s.label}>
                        <div className="stat-top">
                          {s.label}
                          <s.icon size={17} />
                        </div>
                        <div className="stat-value">
                          <CountUp to={s.value} />
                        </div>
                        <span className="stat-note">{s.note}</span>
                      </div>
                    ))}
                  </div>
                  <ActivityChart daily={overview?.daily || []} />
                  <div className="panel analytics-note">
                    <Eye size={20} />
                    <div>
                      <h3>Your work, in the world</h3>
                      <p>
                        Publishing metrics appear after clips are posted through
                        a connected account.
                      </p>
                    </div>
                  </div>
                </>
              )}
              {view === "settings" && (
                <SettingsPage
                  status={status}
                  connection={connection}
                  accounts={data.accounts || []}
                  notify={notify}
                  refresh={refresh}
                  onSignIn={() => setModal({ type: "auth" })}
                />
              )}
              <footer>
                <span>
                  <img src="/favicon.svg" alt="" />
                  Made for the moments that matter.
                </span>
                <span>
                  <span
                    className={`status-dot ${["online", "signin"].includes(connection) ? "online" : ""}`}
                  />
                  {["online", "signin"].includes(connection)
                    ? "Local engine connected"
                    : connection === "loading"
                      ? "Connecting to video engine"
                      : "Local engine offline"}
                  <span className="footer-sep">/</span>PeakCut Studio
                </span>
              </footer>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <CircleAlert size={18} />
            <span>{toast}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal && (
          <Modal
            title={
              {
                project: "Make something worth sharing.",
                creator: "A new creative corner.",
                job:
                  modal.job?.name || modal.job?.source?.name || "Your project",
                help: "From video to your next great clip.",
                auth: "Welcome to your creative corner.",
              }[modal.type]
            }
            subtitle={
              {
                project: "One video. A whole lot of possibilities.",
                creator: "Give this creator their own place to grow.",
                help: "Three small steps to your next big moment.",
              }[modal.type]
            }
            wide={modal.type === "project" || modal.type === "job"}
            onClose={() => setModal(null)}
          >
            {modal.type === "project" && (
              <ProjectForm
                creators={data.creators || []}
                connection={connection}
                onDone={() => {
                  setModal(null);
                  setView("videos");
                  refresh();
                  notify("Your video is queued. We’ll take it from here.");
                }}
                notify={notify}
              />
            )}
            {modal.type === "creator" && (
              <CreatorForm
                onDone={() => {
                  setModal(null);
                  refresh();
                  setView("creators");
                  notify("Creator added. Make yourself at home.");
                }}
              />
            )}
            {modal.type === "job" && (
              <JobDetails
                job={data.jobs.find((j) => j.id === modal.job.id) || modal.job}
              />
            )}{" "}
            {modal.type === "help" && (
              <div className="help-steps">
                <div className="subtle-note">
                  <MonitorPlay size={18} />
                  <p>
                    First, open <strong>Start PeakCut Engine.command</strong> on
                    this computer and keep its window running. If your browser
                    asks, allow this site to connect to your local network.
                    Videos stay on this computer.
                  </p>
                </div>
                {[
                  [
                    "01",
                    "Bring your video",
                    "Paste a YouTube, Twitch, or Kick link, or upload an MP4, MOV, MKV, or WebM file.",
                  ],
                  [
                    "02",
                    "Give it your signature",
                    "Choose your clip length, caption style, and video layout. An AI key helps find the most interesting moments; loudness works without one.",
                  ],
                  [
                    "03",
                    "Make it yours",
                    "Preview your finished clips, download them, and share them. Connect your social accounts in Settings to publish.",
                  ],
                ].map(([n, t, p]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <section>
                      <h3>{t}</h3>
                      <p>{p}</p>
                    </section>
                  </div>
                ))}
                <Button onClick={openProject}>
                  Let’s make a clip <ArrowUpRight size={16} />
                </Button>
              </div>
            )}
            {modal.type === "auth" && (
              <AuthForm
                onDone={() => {
                  setModal(null);
                  refresh();
                }}
              />
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading standalone">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function ProjectList({ jobs, onOpen }) {
  return (
    <div className="project-list">
      {jobs.map((j) => (
        <button className="project-row" key={j.id} onClick={() => onOpen(j)}>
          <div className="project-thumb">
            <Film size={22} />
            <span>9:16</span>
          </div>
          <div className="project-info">
            <strong>{j.name || j.source?.name || "Untitled video"}</strong>
            <p>
              {(j.clips || []).filter((c) => c.status === "done").length} clips
              <span>·</span>
              {j.created
                ? new Date(j.created * 1000).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "Just now"}
            </p>
          </div>
          <Pill
            tone={
              j.status === "done"
                ? "green"
                : j.status === "error"
                  ? "red"
                  : "sand"
            }
          >
            {j.status === "done" ? (
              <Check size={12} />
            ) : j.status === "error" ? (
              <CircleAlert size={12} />
            ) : (
              <Clock3 size={12} />
            )}{" "}
            {j.status === "done"
              ? "Ready to share"
              : j.status === "error"
                ? "Needs attention"
                : j.stage || j.status}
          </Pill>
          <ArrowUpRight className="row-arrow" size={17} />
        </button>
      ))}
    </div>
  );
}
function Library({ jobs, query, onOpen, onNew }) {
  const [filter, setFilter] = useState("all");
  const filtered = jobs.filter(
    (j) =>
      (filter === "all" ||
        (filter === "ready"
          ? j.status === "done"
          : filter === "processing"
            ? stages.includes(j.status)
            : j.status === "error")) &&
      String(j.name || j.source?.name || "")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="filter-bar">
        <div className="tabs" role="tablist" aria-label="Project status">
          {[
            ["all", "All projects"],
            ["ready", "Ready to share"],
            ["processing", "In progress"],
            ["error", "Needs attention"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={filter === id}
              onClick={() => setFilter(id)}
              className={filter === id ? "selected" : ""}
            >
              {label}
              {id === "all" && <span>{jobs.length}</span>}
            </button>
          ))}
        </div>
        <span className="library-count">{filtered.length} projects</span>
      </div>
      {filtered.length ? (
        <ProjectList jobs={filtered} onOpen={onOpen} />
      ) : (
        <Empty
          title={
            query
              ? "No matching videos"
              : filter === "all"
                ? "Your best moments are still ahead"
                : "Nothing here just yet"
          }
          description={
            query
              ? "Try a different search."
              : filter === "all"
                ? "Drop in your first video and turn long-form into something unmissable."
                : "Projects with this status will appear here."
          }
          action={
            filter === "all" &&
            !query && (
              <Button onClick={onNew}>
                <Plus size={16} />
                Create a project
              </Button>
            )
          }
        />
      )}
    </>
  );
}

function ProjectForm({ creators, connection, onDone, notify }) {
  const [mode, setMode] = useState("link");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [options, setOptions] = useState(defaults);
  const [creator, setCreator] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const abort = useRef(null);
  const input = useRef(null);
  useEffect(() => () => abort.current?.abort(), []);
  const opt = (key, value) => setOptions((o) => ({ ...o, [key]: value }));
  const selectFile = (f) => {
    if (!f) return;
    if (!/\.(mp4|mov|mkv|webm|m4v|ts|flv)$/i.test(f.name)) {
      setError("Choose an MP4, MOV, MKV, WebM, M4V, TS, or FLV video.");
      return;
    }
    setFile(f);
    setError("");
  };
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (connection !== "online") {
      setError(
        "Connect the video server before creating a project. Your settings are ready to use when it’s online.",
      );
      return;
    }
    if (options.min_len > options.max_len) {
      setError("The shortest clip must be shorter than the longest clip.");
      return;
    }
    if (mode === "link") {
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        setError("Paste a complete video link, starting with https://.");
        return;
      }
      if (
        ![
          "youtube.com",
          "www.youtube.com",
          "m.youtube.com",
          "youtu.be",
          "twitch.tv",
          "www.twitch.tv",
          "kick.com",
          "www.kick.com",
        ].includes(parsed.hostname) ||
        !["https:", "http:"].includes(parsed.protocol)
      ) {
        setError("Use a YouTube, Twitch, or Kick video link.");
        return;
      }
    } else if (!file) {
      setError("Choose a video to upload first.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "link") await send("/jobs", { url, options, creator });
      else {
        abort.current = new AbortController();
        await upload(file, options, creator, setProgress, abort.current.signal);
      }
      onDone();
    } catch (e) {
      setError(e.name === "AbortError" ? "Upload cancelled." : e.message);
      notify("Your video wasn’t submitted. Check the message and try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="project-form">
      <div className="input-tabs">
        <button
          type="button"
          disabled={busy}
          className={mode === "link" ? "selected" : ""}
          onClick={() => setMode("link")}
        >
          <Link size={16} />
          Paste a link
        </button>
        <button
          type="button"
          disabled={busy}
          className={mode === "upload" ? "selected" : ""}
          onClick={() => setMode("upload")}
        >
          <Upload size={16} />
          Upload a video
        </button>
      </div>
      {mode === "link" ? (
        <label className="field">
          Video link
          <div className="link-input">
            <Link size={18} />
            <input
              type="url"
              required
              value={url}
              disabled={busy}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a YouTube, Twitch or Kick video link"
            />
          </div>
          <small>Long videos, podcasts, streams. Bring your good stuff.</small>
        </label>
      ) : (
        <div
          className={`dropzone ${drag ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy) selectFile(e.dataTransfer.files[0]);
          }}
        >
          <Upload size={28} />
          <h3>{file ? file.name : "Drop your video right here"}</h3>
          <p>
            {file
              ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Ready to go`
              : "MP4, MOV, MKV, WebM, and more"}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => input.current.click()}
          >
            {file ? "Choose another file" : "Browse files"}
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            accept=".mp4,.mov,.mkv,.webm,.m4v,.ts,.flv"
            onChange={(e) => selectFile(e.target.files[0])}
          />
        </div>
      )}
      <div className="form-divider">
        <span>MAKE IT YOURS</span>
        <SlidersHorizontal size={14} />
      </div>
      <div className="form-columns">
        <label className="field">
          Number of clips
          <input
            type="number"
            min="1"
            max="20"
            value={options.max_clips}
            onChange={(e) => opt("max_clips", Number(e.target.value))}
          />
        </label>
        <label className="field">
          Shortest clip{" "}
          <span className="input-unit">
            <input
              type="number"
              min="5"
              max="120"
              value={options.min_len}
              onChange={(e) => opt("min_len", Number(e.target.value))}
            />
            <small>seconds</small>
          </span>
        </label>
        <label className="field">
          Longest clip
          <span className="input-unit">
            <input
              type="number"
              min="10"
              max="180"
              value={options.max_len}
              onChange={(e) => opt("max_len", Number(e.target.value))}
            />
            <small>seconds</small>
          </span>
        </label>
      </div>
      <fieldset className="caption-picker">
        <legend>Caption style</legend>
        <div className="caption-options">
          {[
            ["bounce", "Bounce"],
            ["hype", "Hype"],
            ["clean", "Clean"],
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={options.style === key}
              onClick={() => opt("style", key)}
              className={`${key} ${options.style === key ? "selected" : ""}`}
            >
              <span>
                MAKE IT <em>COUNT</em>
              </span>
              <small>
                {label}
                {options.style === key && <Check size={12} />}
              </small>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="form-columns two">
        <label className="field">
          Video layout
          <select
            value={options.layout}
            onChange={(e) => opt("layout", e.target.value)}
          >
            <option value="blur">Blurred fill</option>
            <option value="zoom">Zoomed in</option>
            <option value="crop">Fill screen</option>
          </select>
        </label>
        <label className="field">
          Export quality
          <select
            value={options.quality}
            onChange={(e) => opt("quality", Number(e.target.value))}
          >
            <option value="720">720p · Faster</option>
            <option value="1080">1080p · Sharper</option>
          </select>
        </label>
      </div>
      {creators.length > 0 && (
        <label className="field">
          Creator workspace
          <select value={creator} onChange={(e) => setCreator(e.target.value)}>
            <option value="">No creator · My workspace</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          <CircleAlert size={16} />
          {error}
        </p>
      )}
      {busy && mode === "upload" && (
        <div className="upload-progress">
          <span style={{ width: `${progress}%` }} />
          <small>Uploading {progress}%</small>
        </div>
      )}
      <div className="form-footer">
        <span>
          <Sparkles size={14} />A little AI. A lot of potential.
        </span>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Scissors size={16} />
          )}{" "}
          {busy ? "Making it happen…" : "Make my clips"}
          {!busy && <ArrowUpRight size={16} />}
        </Button>
      </div>
    </form>
  );
}

function CreatorForm({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="simple-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await send("/creators", {
            name: f.get("name"),
            channel: f.get("channel"),
          });
          onDone();
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        Creator name
        <input
          name="name"
          required
          maxLength={100}
          placeholder="e.g. The Sunday Podcast"
        />
      </label>
      <label className="field">
        Channel link <small>Optional</small>
        <input
          name="channel"
          type="url"
          placeholder="https://youtube.com/@yourchannel"
        />
        <small>YouTube, Twitch, or Kick. You can add this later.</small>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Plus size={16} />
        )}
        Create workspace
      </Button>
    </form>
  );
}

function ClipPlayer({ path }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const asset = useRef("");
  const abort = useRef(null);
  useEffect(
    () => () => {
      abort.current?.abort();
      if (asset.current) URL.revokeObjectURL(asset.current);
    },
    [],
  );
  async function play() {
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const blob = await fetchClip(path, abort.current.signal);
      asset.current = URL.createObjectURL(blob);
      setUrl(asset.current);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return url ? (
    <video src={url} controls autoPlay playsInline />
  ) : (
    <div className="clip-preview">
      <Button variant="outline" onClick={play} disabled={busy}>
        {busy ? (
          <LoaderCircle size={18} className="spin" />
        ) : (
          <Play size={18} />
        )}{" "}
        {busy ? "Loading clip…" : "Preview clip"}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function JobDetails({ job }) {
  const [downloadError, setDownloadError] = useState("");
  const ready = (job.clips || []).filter((c) => c.status === "done");
  return (
    <div className="job-detail">
      <div className="job-status">
        <Pill
          tone={
            job.status === "done"
              ? "green"
              : job.status === "error"
                ? "red"
                : "sand"
          }
        >
          {job.status}
        </Pill>
        <span>{job.stage}</span>
      </div>
      {job.error && <p className="form-error">{job.error}</p>}
      {downloadError && (
        <p className="form-error" role="alert">
          {downloadError}
        </p>
      )}
      {ready.length ? (
        <div className="clips-grid">
          {ready.map((c) => (
            <div className="clip-card" key={c.id}>
              <ClipPlayer
                path={`/media/${job.id}/${c.file || c.filename || c.id + ".mp4"}`}
              />
              <div>
                <h3>{c.title || c.hook || "Your highlight"}</h3>
                <p>
                  {duration(c.end - c.start)}
                  <span> · </span>
                  {c.score ? `${c.score} score` : "Ready to share"}
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadClip(
                      `/media/${job.id}/${c.file || c.filename || c.id + ".mp4"}?download=1`,
                      c.file || c.filename || "peakcut-clip.mp4",
                    ).catch((err) => setDownloadError(err.message))
                  }
                >
                  <Download size={15} />
                  Download clip
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={job.status === "error" ? CircleAlert : Clock3}
          title={
            job.status === "error"
              ? "This one needs another look"
              : "Good things are in the making"
          }
          description={
            job.status === "error"
              ? "Check the error above, fix the issue, and create a new project."
              : job.stage ||
                "Your clips will appear here as soon as they’re ready."
          }
        />
      )}
    </div>
  );
}

function ActivityChart({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.clips));
  return (
    <section className="panel activity-chart">
      <div className="section-heading">
        <div>
          <h2>A little progress, every day.</h2>
          <p>Clips created in the last 14 days</p>
        </div>
        <Pill>Last 14 days</Pill>
      </div>
      <div
        className="chart-bars"
        role="img"
        aria-label={`Clips created in the last 14 days: ${daily.map((d) => d.day + ": " + d.clips).join(", ") || "No activity yet"}`}
      >
        {(daily.length
          ? daily
          : Array.from({ length: 14 }, (_, i) => ({
              day: String(i + 1),
              clips: 0,
            }))
        ).map((d, i) => (
          <div className="chart-column" key={d.day}>
            <span
              title={`${d.day}: ${d.clips} clips`}
              style={{ height: `${Math.max(2, (d.clips / max) * 100)}%` }}
            />
            {i % 2 === 0 && (
              <small>{daily.length ? d.day.slice(5) : "—"}</small>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsPage({
  status,
  connection,
  accounts,
  notify,
  refresh,
  onSignIn,
}) {
  const [tab, setTab] = useState("ai");
  const [ai, setAi] = useState({
    provider: "gemini",
    models: "",
    key: "",
    base_url: "",
  });
  const [savedAi, setSavedAi] = useState(null);
  const [storage, setStorage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    if (connection === "online") {
      api("/ai")
        .then((d) => {
          if (live) {
            setSavedAi(d);
            setAi((a) => ({ ...a, ...d, key: "" }));
          }
        })
        .catch(() => {});
      api("/storage")
        .then((d) => {
          if (live) setStorage(d);
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [connection]);
  const action = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your studio. Your way."
        description="The little details that make your workspace yours."
      />
      <div className="settings-layout">
        <div className="settings-nav">
          {[
            ["ai", "AI & intelligence", Sparkles],
            ["apps", "Connected accounts", Link],
            ["storage", "Storage & engine", Cloud],
            ["account", "Your account", Users],
          ].map(([id, label, Icon]) => (
            <button
              className={tab === id ? "selected" : ""}
              onClick={() => {
                setTab(id);
                setError("");
              }}
              key={id}
            >
              <Icon size={17} />
              {label}
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
        <section className="panel settings-panel">
          {tab === "ai" && (
            <>
              <div className="settings-title">
                <span className="stat-icon coral">
                  <Sparkles size={21} />
                </span>
                <div>
                  <h2>A creative partner, on your terms.</h2>
                  <p>Bring your own AI key. Pick the moments that matter.</p>
                </div>
              </div>
              <div className="subtle-note">
                <CheckCircle2 size={17} />
                <p>
                  Your key stays on your video server. Without a key, PeakCut
                  uses loudness to find highlights.
                </p>
              </div>
              {status?.accounts && !status?.user?.is_admin ? (
                <div className="subtle-note">
                  <Users size={17} />
                  <p>
                    AI settings are managed by your workspace administrator. You
                    can still create clips without an AI key once the video
                    engine is ready.
                  </p>
                </div>
              ) : (
                <form
                  className="simple-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    action(async () => {
                      await send("/ai", ai, "PUT");
                      setAi((a) => ({ ...a, key: "" }));
                      await send("/ai/test", {});
                      notify(
                        "AI connected and tested. Ready to find your best moments.",
                      );
                    });
                  }}
                >
                  <label className="field">
                    AI provider
                    <select
                      value={ai.provider}
                      onChange={(e) => {
                        setModels([]);
                        setAi({ ...ai, provider: e.target.value, models: "" });
                      }}
                    >
                      {[
                        ["gemini", "Google Gemini"],
                        ["openai", "OpenAI"],
                        ["anthropic", "Anthropic Claude"],
                        ["groq", "Groq"],
                        ["openrouter", "OpenRouter"],
                        ["xai", "Grok (xAI)"],
                        ["ollama", "Ollama · Local"],
                        ["custom", "Custom · OpenAI compatible"],
                      ].map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    API key
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={
                        savedAi?.has_key
                          ? "Key saved · leave blank to keep it"
                          : "Paste your provider’s API key"
                      }
                      value={ai.key}
                      onChange={(e) => setAi({ ...ai, key: e.target.value })}
                    />
                  </label>
                  {["custom", "ollama"].includes(ai.provider) && (
                    <label className="field">
                      Base URL
                      <input
                        type="url"
                        placeholder="https://your-provider.example/v1"
                        value={ai.base_url || ""}
                        onChange={(e) =>
                          setAi({ ...ai, base_url: e.target.value })
                        }
                      />
                    </label>
                  )}
                  <label className="field">
                    Model
                    <div className="model-row">
                      <input
                        list="available-models"
                        placeholder="Find models or enter a model ID"
                        value={
                          Array.isArray(ai.models)
                            ? ai.models.join(", ")
                            : ai.models || ""
                        }
                        onChange={(e) =>
                          setAi({ ...ai, models: e.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            const d = await send("/ai/models", ai);
                            setModels(d.models || []);
                            notify(
                              "Available models loaded. Choose one in the model field.",
                            );
                          })
                        }
                      >
                        Find models
                      </Button>
                    </div>
                    <datalist id="available-models">
                      {models.map((m) => (
                        <option
                          key={typeof m === "string" ? m : m.id}
                          value={typeof m === "string" ? m : m.id}
                        />
                      ))}
                    </datalist>
                  </label>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div>
                    <Button type="submit" disabled={busy}>
                      {busy ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Check size={16} />
                      )}
                      Save & test connection
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
          {tab === "apps" && (
            <>
              <div className="settings-title">
                <span className="stat-icon lilac">
                  <Link size={21} />
                </span>
                <div>
                  <h2>Good content deserves to get out.</h2>
                  <p>Connect your channels to publish from PeakCut.</p>
                </div>
              </div>
              {["youtube", "instagram", "tiktok"].map((p) => (
                <div className="connected-row" key={p}>
                  <span className={`platform-icon ${p}`}>
                    {p === "youtube" ? "▷" : p === "instagram" ? "◎" : "♪"}
                  </span>
                  <div>
                    <h3>
                      {p === "youtube"
                        ? "YouTube"
                        : p === "instagram"
                          ? "Instagram"
                          : "TikTok"}
                    </h3>
                    <p>
                      {accounts
                        .filter((a) => a.platform === p)
                        .map((a) => a.name || a.label || "Connected")
                        .join(", ") || "No account connected"}
                    </p>
                  </div>
                  {status?.connect?.[p] ? (
                    <a
                      className="button outline"
                      href={localEngineRoute(`/oauth/${p}/start`)}
                    >
                      Connect <ArrowUpRight size={14} />
                    </a>
                  ) : (
                    <Pill>Server setup needed</Pill>
                  )}
                </div>
              ))}
              <p className="muted settings-footnote">
                The video server needs the platform’s OAuth credentials before
                you can connect an account.
              </p>
            </>
          )}
          {tab === "storage" && (
            <>
              <div className="settings-title">
                <span className="stat-icon green">
                  <Cloud size={21} />
                </span>
                <div>
                  <h2>Room for your next big idea.</h2>
                  <p>Videos, clips, and your AI key stay on this computer.</p>
                </div>
              </div>
              <div className="detail-row">
                <span>Video engine</span>
                <Pill tone={connection === "online" ? "green" : ""}>
                  {connection === "online" ? "Connected" : "Offline"}
                </Pill>
              </div>
              <div className="detail-row">
                <span>FFmpeg</span>
                <strong>
                  {connection !== "online"
                    ? "Waiting for server"
                    : status?.no_ffmpeg
                      ? "Installation needed"
                      : "Installed & ready"}
                </strong>
              </div>
              <div className="detail-row">
                <span>Storage</span>
                <strong>
                  {storage?.path ||
                    storage?.folder ||
                    "Managed by the video server"}
                </strong>
              </div>
              <div className="subtle-note">
                <Cloud size={18} />
                <p>
                  Videos, clips, and the speech model need persistent server
                  storage. Your Vercel frontend stays fast while the engine does
                  the heavy lifting.
                </p>
              </div>
              <Button variant="outline" onClick={refresh}>
                <RefreshCw size={15} />
                Check connection
              </Button>
            </>
          )}
          {tab === "account" && (
            <>
              <h2>Your creative corner.</h2>
              <p className="muted">
                {status?.user?.email || "Your local PeakCut workspace"}
              </p>
              <div className="detail-row">
                <span>Account name</span>
                <strong>{status?.user?.name || "Local owner"}</strong>
              </div>
              <div className="detail-row">
                <span>Sign-in</span>
                <strong>
                  {status?.accounts ? "Enabled" : "Local workspace"}
                </strong>
              </div>
              {connection === "signin" ? (
                <Button onClick={onSignIn}>
                  Sign in <ArrowUpRight size={15} />
                </Button>
              ) : (
                status?.accounts && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      action(async () => {
                        await send("/auth/logout", {});
                        refresh();
                        notify("You’re signed out.");
                      })
                    }
                  >
                    <LogOut size={16} />
                    Sign out
                  </Button>
                )
              )}
              <a
                className="button outline"
                href={fullStudioUrl}
                style={{ marginTop: 24 }}
              >
                Open full editing workspace <ArrowUpRight size={15} />
              </a>
              <a
                className="source-link"
                href="https://github.com/haziqahmedqasmi/PeakCut"
                target="_blank"
                rel="noreferrer"
              >
                <Code2 size={17} />
                Built on the open-source PeakCut engine
                <ArrowUpRight size={14} />
              </a>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function AuthForm({ onDone }) {
  const [signup, setSignup] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="simple-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await send(
            `/auth/${signup ? "signup" : "login"}`,
            Object.fromEntries(f),
          );
          onDone();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {signup && (
        <label className="field">
          Your name
          <input name="name" required autoComplete="name" />
        </label>
      )}
      <label className="field">
        Email
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className="field">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={signup ? 10 : 1}
          autoComplete={signup ? "new-password" : "current-password"}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <ArrowRight size={16} />
        )}{" "}
        {signup ? "Create account" : "Sign in"}
      </Button>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setSignup(!signup);
          setError("");
        }}
      >
        {signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </form>
  );
}
