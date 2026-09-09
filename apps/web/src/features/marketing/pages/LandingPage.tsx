import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Apple,
  ArrowRight,
  Check,
  Dumbbell,
  LineChart,
  Lock,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { useSession } from '@/features/auth/api';
import { Screenshot } from '../components/Screenshot';

/** Marketing landing page — the signed-out face of atlas-fitness.org.
 * Deliberately its own fixed dark palette (not the app's theme tokens): the
 * app can be re-themed per user; the brand page always looks the same. */

const ACCENT_TEXT = 'bg-linear-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent';
const CTA_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-400 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-[#050509] shadow-[0_8px_30px_-8px_rgba(34,211,238,0.6)] transition-opacity hover:opacity-90';
const GHOST_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/5';

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="mb-3 text-sm font-semibold tracking-widest text-cyan-300/90 uppercase">
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
        {title}
      </h2>
      {children && <p className="mt-4 text-base leading-relaxed text-white/60">{children}</p>}
    </div>
  );
}

function FeatureBlock({
  icon,
  eyebrow,
  title,
  copy,
  bullets,
  shot,
  flip = false,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  copy: string;
  bullets: string[];
  shot: { src: string; alt: string; label: string };
  flip?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-10 md:gap-16 ${
        flip ? 'md:flex-row-reverse' : 'md:flex-row'
      }`}
    >
      <div className="max-w-md flex-1">
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-300">
          {icon}
        </span>
        <p className="mb-2 text-sm font-semibold tracking-widest text-cyan-300/90 uppercase">
          {eyebrow}
        </p>
        <h3 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
          {title}
        </h3>
        <p className="mt-3 leading-relaxed text-white/60">{copy}</p>
        <ul className="mt-5 space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-white/75">
              <Check size={16} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className="w-full flex-1">
        <Screenshot {...shot} />
      </div>
    </div>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do I need a credit card for the trial?',
    a: 'No. Every account starts with 7 days of full access — no payment method, no surprise charge when the trial ends. If Atlas earns a place in your routine, subscribe then.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, in two clicks from Settings — billing is handled by Stripe and cancelling takes effect at the end of the period you already paid for. No retention screens, no emails to support.',
  },
  {
    q: 'What happens to my data if I stop subscribing?',
    a: 'Nothing. Everything you tracked stays safe, and it is all waiting for you if you come back. You can also delete your account entirely — data is recoverable for 14 days, then permanently erased.',
  },
  {
    q: 'Does Atlas sell my data or run ads?',
    a: 'Never. Your subscription is the business model — there is no ad network, no data broker, no "partners". Your logs live on your device; the sync server stores an encrypted-in-transit copy it never analyzes.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Atlas works great in your phone browser today — add it to your home screen for the full-screen experience. A native Android app with GPS run tracking and watch integration via Health Connect is in active development.',
  },
];

export function LandingPage() {
  const session = useSession();
  const signedIn = Boolean(session.data);

  return (
    // The app shell pins html/body/#root to 100% height — every page owns its
    // scrolling, so the landing page is its own scroll container (which also
    // keeps the sticky nav working).
    <div className="h-full overflow-y-auto bg-[#050509] font-sans text-white antialiased">
      {/* ------------------------------ Nav ------------------------------ */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#050509]/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <img src="/assets/logo/atlas_logo.png" alt="Atlas by Arcadia" className="h-8 w-auto" />
          <div className="hidden items-center gap-7 text-sm text-white/60 md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#privacy" className="transition-colors hover:text-white">
              Privacy
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              Pricing
            </a>
            <a href="#faq" className="transition-colors hover:text-white">
              FAQ
            </a>
          </div>
          <div className="flex items-center gap-3">
            {signedIn ? (
              <Link to="/" className={`${CTA_CLASSES} px-4 py-2`}>
                Open Atlas
              </Link>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="text-sm font-medium text-white/70 transition-colors hover:text-white"
                >
                  Sign in
                </Link>
                <Link to="/signin?mode=register" className={`${CTA_CLASSES} px-4 py-2`}>
                  Start free
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ------------------------------ Hero ----------------------------- */}
      <section className="relative overflow-hidden">
        {/* glow field */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(34,211,238,0.14),transparent_70%),radial-gradient(40%_40%_at_80%_20%,rgba(232,121,249,0.10),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-16 text-center md:pt-28">
          <p className="mx-auto mb-5 w-fit rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70">
            Training · Nutrition · Progress · Community
          </p>
          <h1 className="font-display mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Your fitness, <span className={ACCENT_TEXT}>in one place</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/60">
            Atlas connects what every other app keeps separate — your workouts, your food, your
            weight, your goals — so you can see the whole picture and act on it.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={signedIn ? '/' : '/signin?mode=register'} className={CTA_CLASSES}>
              Start your free trial
              <ArrowRight size={16} aria-hidden />
            </Link>
            <a href="#features" className={GHOST_CLASSES}>
              See what's inside
            </a>
          </div>
          <p className="mt-4 text-sm text-white/40">7 days free · no credit card required</p>

          <div className="relative mt-14">
            <Screenshot
              src="/marketing/dashboard.png"
              alt="The Atlas dashboard: calories, protein, today's training, weight trend and weekly progress in one view"
              label="Dashboard screenshot — /marketing/dashboard.png"
              className="mx-auto max-w-4xl"
            />
          </div>
        </div>
      </section>

      {/* --------------------------- Features ---------------------------- */}
      <section id="features" className="mx-auto max-w-6xl space-y-24 px-5 py-24 md:space-y-32">
        <SectionHeading eyebrow="One system" title="Everything talks to everything">
          Five tabs that happen to share an app is not a fitness system. Atlas understands that
          your nutrition, training, and progress are one program — and shows you exactly where you
          stand today.
        </SectionHeading>

        <FeatureBlock
          icon={<Dumbbell size={20} aria-hidden />}
          eyebrow="Train"
          title="A serious training log, not a checkbox"
          copy="Plan your week, run guided sessions, and watch strength climb. Atlas remembers every set so the next session starts where the last one ended."
          bullets={[
            'Workout plans with a weekly schedule and rest days',
            'Set-by-set logging with previous values at a glance',
            'Personal records, training volume and progress charts',
            'A curated exercise library, filterable by your equipment',
          ]}
          shot={{
            src: '/marketing/train.png',
            alt: 'Logging a workout session in Atlas',
            label: 'Training screenshot — /marketing/train.png',
          }}
        />

        <FeatureBlock
          icon={<Apple size={20} aria-hidden />}
          eyebrow="Eat"
          title="Food tracking that respects your time"
          copy="Search a huge food database, scan barcodes, save recipes, plan the week's meals — and let the shopping list write itself from the plan."
          bullets={[
            'Calorie and macro tracking with daily targets built from your goal',
            'Barcode scanning and restaurant-grade food search',
            'Recipes, weekly meal planning and one-tap diary logging',
            'A shopping list generated straight from your meal plan',
          ]}
          shot={{
            src: '/marketing/eat.png',
            alt: 'The Atlas food diary and meal plan',
            label: 'Nutrition screenshot — /marketing/eat.png',
          }}
          flip
        />

        <FeatureBlock
          icon={<LineChart size={20} aria-hidden />}
          eyebrow="Progress"
          title="See the trend, not the noise"
          copy="Daily weigh-ins lie; trends don't. Atlas tracks your weight trend, goal progress and adherence week over week — and tells you when the plan is working."
          bullets={[
            'Weight trend over 30 and 90 days, not single readings',
            'Goals with honest progress tracking toward each one',
            'Weekly pulse: training adherence, eating vs. plan, momentum',
            'Calorie targets recalculated as your body changes',
          ]}
          shot={{
            src: '/marketing/progress.png',
            alt: 'Progress charts in Atlas',
            label: 'Progress screenshot — /marketing/progress.png',
          }}
        />

        <FeatureBlock
          icon={<Users size={20} aria-hidden />}
          eyebrow="Together"
          title="Train with your people"
          copy="Fitness sticks when someone's watching. Add friends, form groups, share plans and recipes, and keep score with shared weekly stats."
          bullets={[
            'Friends with shared weekly stats — volume, streaks, cardio',
            'Groups for your gym crew, family or challenge',
            'Publish workout plans and recipes, or share them privately',
            'Community ratings and reviews on shared plans',
          ]}
          shot={{
            src: '/marketing/social.png',
            alt: 'Friends and groups in Atlas',
            label: 'Community screenshot — /marketing/social.png',
          }}
          flip
        />
      </section>

      {/* ---------------------------- Privacy ---------------------------- */}
      <section id="privacy" className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <SectionHeading eyebrow="Privacy" title="Your data isn't the product">
            Most fitness apps monetize you twice — the subscription, then your data. Atlas has one
            business model: you pay for a great product, and that's the end of the transaction.
          </SectionHeading>
          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-3">
            {[
              {
                icon: <Smartphone size={20} aria-hidden />,
                title: 'Local-first',
                copy: 'Your logs live in a database on your device. The app works offline; sync happens when you are.',
              },
              {
                icon: <Lock size={20} aria-hidden />,
                title: 'Sync, not surveillance',
                copy: 'The sync server stores your data only to move it between your devices — it never analyzes or mines it.',
              },
              {
                icon: <ShieldCheck size={20} aria-hidden />,
                title: 'No ads. No brokers.',
                copy: 'Nothing is sold, shared or "anonymized for partners". Delete your account and it is truly gone in 14 days.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/10 bg-[#0b0b12] p-6"
              >
                <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-300">
                  {card.icon}
                </span>
                <h3 className="font-display text-lg font-bold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{card.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- Pricing ---------------------------- */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading eyebrow="Pricing" title="One plan. Everything included.">
          No feature-hostage free tier, no "premium" upsells inside a paid app. Try everything free
          for 7 days, then pick a billing period.
        </SectionHeading>
        <div className="mx-auto mt-12 grid max-w-3xl gap-5 md:grid-cols-2">
          {[
            {
              name: 'Monthly',
              price: '$10',
              per: '/ month',
              note: 'Flexible — cancel anytime.',
              highlight: false,
            },
            {
              name: 'Annual',
              price: '$72',
              per: '/ year',
              note: '$6/month equivalent — save 40%.',
              highlight: true,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-7 ${
                plan.highlight
                  ? 'border-cyan-300/40 bg-[#0b0b12] shadow-[0_20px_80px_-30px_rgba(34,211,238,0.5)]'
                  : 'border-white/10 bg-[#0b0b12]'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 right-6 rounded-full bg-linear-to-r from-cyan-400 to-fuchsia-500 px-3 py-1 text-xs font-bold text-[#050509]">
                  Best value
                </span>
              )}
              <p className="text-sm font-semibold text-white/70">{plan.name}</p>
              <p className="mt-2">
                <span className="font-display text-4xl font-bold text-white">{plan.price}</span>
                <span className="ml-1 text-sm text-white/50">{plan.per}</span>
              </p>
              <p className="mt-1 text-sm text-white/50">{plan.note}</p>
              <ul className="mt-5 space-y-2.5">
                {[
                  'Every feature — training, nutrition, progress, community',
                  'Sync across all your devices',
                  '7-day free trial, no card required',
                  'Cancel in two clicks',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-white/75">
                    <Check size={16} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <Link
                to="/signin?mode=register"
                className={`${plan.highlight ? CTA_CLASSES : GHOST_CLASSES} mt-6 w-full`}
              >
                Start free trial
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------ FAQ ------------------------------ */}
      <section id="faq" className="border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-3xl px-5 py-24">
          <SectionHeading eyebrow="FAQ" title="Fair questions" />
          <div className="mt-10 space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-2xl border border-white/10 bg-[#0b0b12] px-5 py-4 open:pb-5"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-white/85 transition-colors group-open:text-white">
                  {faq.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- Final CTA --------------------------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(232,121,249,0.12),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl px-5 py-24 text-center">
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-bold tracking-tight md:text-5xl">
            Stop juggling apps. <span className={ACCENT_TEXT}>Start seeing progress.</span>
          </h2>
          <div className="mt-8">
            <Link to={signedIn ? '/' : '/signin?mode=register'} className={CTA_CLASSES}>
              Start your free trial
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/40">7 days free · no credit card · cancel anytime</p>
        </div>
      </section>

      {/* ----------------------------- Footer ---------------------------- */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-white/40 md:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/assets/logo/atlas_logo.png" alt="" className="h-6 w-auto opacity-70" />
            <span>© {new Date().getFullYear()} Arcadia Atlas</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#pricing" className="transition-colors hover:text-white/70">
              Pricing
            </a>
            <a href="#faq" className="transition-colors hover:text-white/70">
              FAQ
            </a>
            <Link to="/signin" className="transition-colors hover:text-white/70">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
