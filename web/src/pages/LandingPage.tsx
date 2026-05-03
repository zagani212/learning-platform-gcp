import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgb(61 124 107 / 0.25), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgb(224 120 86 / 0.12), transparent)',
        }}
      />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <span className="font-display text-xl font-semibold tracking-tight text-ink-900">
          School Hub
        </span>
        <Link to="/login">
          <Button variant="secondary" className="text-sm">
            Sign in
          </Button>
        </Link>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wider text-accent-dark">
            Multi-school learning
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink-950 md:text-5xl">
            One platform for every school account, every role, every course.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-600">
            Teachers publish PDFs, videos, and links. Students discover classes and follow the ones
            that fit their path. School admins keep the roster in one place — ready to wire to your
            backend on GCP when you are.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/login">
              <Button className="px-6 py-3">Sign in</Button>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center rounded-lg px-4 py-3 text-sm font-medium text-ink-600 underline-offset-4 hover:underline"
            >
              How it works
            </a>
          </div>
        </div>
        <div
          id="how"
          className="mt-24 grid gap-6 md:grid-cols-3"
        >
          {[
            {
              title: 'School accounts',
              body: 'Each school is isolated. Users only see their campus, courses, and enrollments.',
            },
            {
              title: 'Role-aware UI',
              body: 'Admins, teachers, assistants, and students each get workflows tuned to what they do daily.',
            },
            {
              title: 'Rich course materials',
              body: 'Upload PDFs and media or attach external links — students open them right from the course.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-ink-100 bg-white/80 p-6 shadow-soft backdrop-blur"
            >
              <h3 className="font-display text-lg font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
