import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { usePlatform } from '../../state/PlatformContext';

export function TeacherCourseMaterialsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { snapshot, addAssetToCourse, addLinkAsset } = usePlatform();
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const course = useMemo(
    () => snapshot.courses.find((c) => c.id === courseId),
    [snapshot.courses, courseId],
  );
  const assets = useMemo(
    () => (courseId ? snapshot.assets.filter((a) => a.courseId === courseId) : []),
    [snapshot.assets, courseId],
  );

  if (!courseId || !course) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <p className="text-sm text-ink-600">Course not found.</p>
          <Link className="mt-4 inline-block text-sm text-accent-dark" to="/app/teacher">
            ← Back
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link to="/app/teacher" className="text-sm text-ink-500 hover:text-ink-800">
          ← All courses
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink-950">{course.title}</h1>
        <p className="mt-2 text-sm text-ink-600">{course.description}</p>
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-900">Upload files</h2>
        <p className="mt-2 text-sm text-ink-600">
          PDFs, videos, audio, and general documents are supported in this demo (stored in-browser).
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.mp4,.webm,.mp3,.wav,.doc,.docx,.ppt,.pptx,application/pdf,video/*,audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) addAssetToCourse(course.id, f);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" className="mt-4" onClick={() => fileRef.current?.click()}>
          Choose file
        </Button>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-900">Add link</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 md:col-span-2"
            placeholder="Title"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
          />
          <input
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 md:col-span-2"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>
        <Button
          className="mt-4"
          disabled={!linkTitle.trim() || !linkUrl.trim()}
          onClick={() => {
            addLinkAsset(course.id, linkTitle, linkUrl);
            setLinkTitle('');
            setLinkUrl('');
          }}
        >
          Save link
        </Button>
      </Card>

      <div>
        <h2 className="font-display text-lg font-semibold text-ink-900">Materials ({assets.length})</h2>
        <ul className="mt-4 space-y-3">
          {assets.map((a) => (
            <li key={a.id}>
              <Card className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink-900">{a.title}</p>
                    <p className="text-xs capitalize text-ink-500">{a.kind}</p>
                  </div>
                  <a className="text-sm text-accent-dark hover:underline" href={a.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
              </Card>
            </li>
          ))}
          {assets.length === 0 && (
            <p className="text-sm text-ink-500">No materials yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
