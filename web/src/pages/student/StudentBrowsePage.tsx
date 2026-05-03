import { Link } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { usePlatform } from '../../state/PlatformContext';

export function StudentBrowsePage() {
  const { coursesForStudent, myEnrollments, enroll } = usePlatform();
  const enrolledIds = new Set(myEnrollments.map((e) => e.courseId));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-950">Browse courses</h1>
        <p className="mt-2 text-sm text-ink-600">
          Explore classes offered at your school. Follow to add them to your list.
        </p>
      </div>
      <ul className="grid gap-4">
        {coursesForStudent.map((c) => {
          const enrolled = enrolledIds.has(c.id);
          return (
            <li key={c.id}>
              <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-semibold text-ink-900">{c.title}</h2>
                    {enrolled && <Badge tone="accent">Following</Badge>}
                  </div>
                  <p className="mt-2 max-w-xl text-sm text-ink-600">{c.description || 'No description.'}</p>
                  <p className="mt-3 text-xs text-ink-500">Instructor: {c.teacherName}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 md:items-end">
                  {enrolled ? (
                    <Link to="/app/student/following">
                      <Button variant="secondary" className="w-full md:w-auto">
                        View in Following
                      </Button>
                    </Link>
                  ) : (
                    <Button className="w-full md:w-auto" onClick={() => enroll(c.id)}>
                        Follow course
                      </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
        {coursesForStudent.length === 0 && (
          <p className="text-sm text-ink-500">No courses published yet for your school.</p>
        )}
      </ul>
    </div>
  );
}
