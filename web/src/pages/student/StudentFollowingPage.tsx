import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { CourseAsset } from '../../domain/types';
import { openCourseAssetInNewTab } from '../../lib/mediaApi';
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
  const { getAuthorizationHeader } = usePlatform();
  const [err, setErr] = useState<string | null>(null);

  const label =
    asset.kind === 'link' ? 'Visit link'
    : asset.kind === 'video' ? 'Open video'
    : asset.kind === 'image' ? 'Open image'
    : asset.kind === 'pdf' || asset.kind === 'document' ? 'Open file'
    : asset.kind === 'audio' ? 'Open audio'
    : 'Open';

  if (asset.kind === 'link' && !asset.gcsObjectKey) {
    return (
      <a href={asset.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent-dark hover:underline">
        {label}
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="text-sm font-medium text-accent-dark hover:underline"
        onClick={async () => {
          setErr(null);
          const r = await openCourseAssetInNewTab(asset, getAuthorizationHeader);
          if (!r.ok) setErr(r.message);
        }}
      >
        {label}
      </button>
      {err && <span className="max-w-[14rem] text-right text-xs text-red-700">{err}</span>}
    </div>
  );
}
