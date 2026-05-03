import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { usePlatform } from '../../state/PlatformContext';

export function TeacherHomePage() {
  const { coursesICanTeach, createCourse } = usePlatform();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const submit = () => {
    createCourse({ title, description });
    setTitle('');
    setDescription('');
    setOpen(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">Your courses</h1>
          <p className="mt-2 text-sm text-ink-600">
            Create a course and add PDFs, videos, or links for students following it.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>New course</Button>
      </div>

      {open && (
        <Card className="border-accent/40 ring-2 ring-accent/10">
          <h2 className="font-display text-lg font-semibold text-ink-900">New course</h2>
          <label className="mt-4 block text-xs font-medium uppercase text-ink-500">Title</label>
          <input
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Advanced Algebra"
          />
          <label className="mt-4 block text-xs font-medium uppercase text-ink-500">Description</label>
          <textarea
            className="mt-1 min-h-[96px] w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mt-4 flex gap-3">
            <Button onClick={submit} disabled={!title.trim()}>
              Publish
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <ul className="grid gap-4">
        {coursesICanTeach.map((c) => (
          <li key={c.id}>
            <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink-900">{c.title}</h2>
                <p className="mt-2 max-w-xl text-sm text-ink-600">{c.description || 'No description.'}</p>
              </div>
              <Link to={`/app/teacher/course/${c.id}`}>
                <Button variant="secondary">Materials</Button>
              </Link>
            </Card>
          </li>
        ))}
        {!open && coursesICanTeach.length === 0 && (
          <Card>
            <p className="text-sm text-ink-600">
              No courses yet. Use <strong>New course</strong> to publish your first class.
            </p>
          </Card>
        )}
      </ul>
    </div>
  );
}
