import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { CourseAsset } from '../../domain/types';
import { usePlatform } from '../../state/PlatformContext';

export function StudentFollowingPage() {
  const { coursesForStudent, myEnrollments, unenroll, snapshot } = usePlatform();
  const byId = new Map(coursesForStudent.map((c) => [c.id, c]));
  const following = myEnrollments
    .map((e) => byId.get(e.courseId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-950">Following</h1>
        <p className="mt-2 text-sm text-ink-600">
          Courses you follow. Open materials your teachers have shared.
        </p>
      </div>
      <ul className="grid gap-4">
        {following.map((c) => {
          const assets = snapshot.assets.filter((a) => a.courseId === c.id);
          return (
            <li key={c.id}>
              <Card>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink-900">{c.title}</h2>
                    <p className="mt-2 max-w-xl text-sm text-ink-600">{c.description}</p>
                    <p className="mt-2 text-xs text-ink-500">{assets.length} material(s)</p>
                  </div>
                  <Button variant="danger" className="shrink-0" onClick={() => unenroll(c.id)}>
                    Unfollow
                  </Button>
                </div>
                {assets.length > 0 && (
                  <ul className="mt-6 space-y-3 border-t border-ink-100 pt-4">
                    {assets.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink-900">{a.title}</p>
                          <p className="text-xs capitalize text-ink-500">{a.kind}</p>
                        </div>
                        <AssetOpenButton asset={a} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          );
        })}
        {following.length === 0 && (
          <Card>
            <p className="text-sm text-ink-600">
              You are not following any courses yet.{' '}
              <Link className="font-medium text-accent-dark underline underline-offset-2" to="/app/student">
                Browse catalog
              </Link>
              .
            </p>
          </Card>
        )}
      </ul>
    </div>
  );
}

function AssetOpenButton({ asset }: { asset: CourseAsset }) {
  if (asset.kind === 'video') {
    return (
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-accent-dark hover:underline"
      >
        Open video
      </a>
    );
  }
  if (asset.kind === 'pdf' || asset.kind === 'document') {
    return (
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-accent-dark hover:underline"
      >
        Open file
      </a>
    );
  }
  return (
    <a href={asset.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent-dark hover:underline">
      Visit link
    </a>
  );
}
