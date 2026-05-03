import { Card } from '../../components/Card';
import { usePlatform } from '../../state/PlatformContext';

export function AdminCoursesPage() {
  const { currentSchool, coursesForSchool, snapshot } = usePlatform();
  if (!currentSchool) return null;
  const courses = coursesForSchool(currentSchool.id);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-950">All courses</h1>
        <p className="mt-2 text-sm text-ink-600">
          Visibility across instructors for this school — read-only overview.
        </p>
      </div>
      <ul className="grid gap-4">
        {courses.map((c) => {
          const n = snapshot.assets.filter((a) => a.courseId === c.id).length;
          return (
            <li key={c.id}>
              <Card>
                <h2 className="font-display text-lg font-semibold text-ink-900">{c.title}</h2>
                <p className="mt-2 text-sm text-ink-600">{c.description}</p>
                <p className="mt-3 text-xs text-ink-500">
                  Instructor: {c.teacherName} · {n} material(s)
                </p>
              </Card>
            </li>
          );
        })}
        {courses.length === 0 && <p className="text-sm text-ink-500">No courses yet.</p>}
      </ul>
    </div>
  );
}
